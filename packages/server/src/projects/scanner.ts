import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { DEFAULT_PROVIDER, type UrlProjectId } from "@yep-anywhere/shared";
import type { ProjectMetadataService } from "../metadata/index.js";
import type { Project } from "../supervisor/types.js";
import type { EventBus, FileChangeEvent } from "../watcher/index.js";
import { CODEX_SESSIONS_DIR, CodexSessionScanner } from "./codex-scanner.js";
import {
  decodeProjectId,
  isAbsolutePath,
  readCwdFromSessionFile,
} from "./paths.js";

export interface ScannerOptions {
  projectsDir?: string; // deprecated no-op, kept for call-site compatibility
  codexSessionsDir?: string; // override for testing
  enableCodex?: boolean; // whether to include Codex projects (default: true)
  projectMetadataService?: ProjectMetadataService; // for persisting added projects
  /** Optional EventBus for watcher-driven cache invalidation */
  eventBus?: EventBus;
  /** Project snapshot TTL in milliseconds (default: 5000) */
  cacheTtlMs?: number;
}

interface ProjectSnapshot {
  projects: Project[];
  byId: Map<string, Project>;
  bySessionDirSuffix: Map<string, Project>;
  timestamp: number;
}

export class ProjectScanner {
  private codexScanner: CodexSessionScanner | null;
  private enableCodex: boolean;
  private projectMetadataService: ProjectMetadataService | null;
  private cacheTtlMs: number;
  private cacheDirty = true;
  private snapshot: ProjectSnapshot | null = null;
  private inFlightScan: Promise<ProjectSnapshot> | null = null;
  private unsubscribeEventBus: (() => void) | null = null;

  constructor(options: ScannerOptions = {}) {
    this.enableCodex = options.enableCodex ?? true;
    this.codexScanner = this.enableCodex
      ? new CodexSessionScanner({
          sessionsDir: options.codexSessionsDir ?? CODEX_SESSIONS_DIR,
        })
      : null;
    this.projectMetadataService = options.projectMetadataService ?? null;
    this.cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 5000);

    if (options.eventBus) {
      this.unsubscribeEventBus = options.eventBus.subscribe((event) => {
        if (event.type !== "file-change") return;
        this.handleFileChange(event);
      });
    }
  }

  /**
   * Set the project metadata service (for late initialization).
   */
  setProjectMetadataService(service: ProjectMetadataService): void {
    this.projectMetadataService = service;
    this.invalidateCache();
  }

  async listProjects(): Promise<Project[]> {
    const snapshot = await this.getSnapshot();
    return snapshot.projects.map((project) => this.cloneProject(project));
  }

  /**
   * Mark the project snapshot stale so next read triggers a rescan.
   */
  invalidateCache(): void {
    this.cacheDirty = true;
  }

  private async getSnapshot(forceRefresh = false): Promise<ProjectSnapshot> {
    const now = Date.now();
    const isFresh =
      this.snapshot &&
      !this.cacheDirty &&
      now - this.snapshot.timestamp < this.cacheTtlMs;

    if (!forceRefresh && isFresh && this.snapshot) {
      return this.snapshot;
    }

    if (this.inFlightScan) {
      return this.inFlightScan;
    }

    const scanPromise = this.scanProjects()
      .then((projects) => {
        const snapshot = this.buildSnapshot(projects);
        this.snapshot = snapshot;
        this.cacheDirty = false;
        return snapshot;
      })
      .finally(() => {
        if (this.inFlightScan === scanPromise) {
          this.inFlightScan = null;
        }
      });

    this.inFlightScan = scanPromise;
    return scanPromise;
  }

  private buildSnapshot(projects: Project[]): ProjectSnapshot {
    const byId = new Map<string, Project>();
    const bySessionDirSuffix = new Map<string, Project>();

    for (const project of projects) {
      byId.set(project.id, project);

      const primarySuffix = this.normalizeDirSuffix(
        this.sessionDirToSuffix(project.sessionDir),
      );
      if (primarySuffix) {
        bySessionDirSuffix.set(primarySuffix, project);
      }

      for (const mergedDir of project.mergedSessionDirs ?? []) {
        const mergedSuffix = this.normalizeDirSuffix(
          this.sessionDirToSuffix(mergedDir),
        );
        if (mergedSuffix) {
          bySessionDirSuffix.set(mergedSuffix, project);
        }
      }
    }

    return {
      projects,
      byId,
      bySessionDirSuffix,
      timestamp: Date.now(),
    };
  }

  private sessionDirToSuffix(sessionDir: string): string {
    return sessionDir.replace(/^[\\/]+/, "");
  }

  private normalizeDirSuffix(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  private cloneProject(project: Project): Project {
    return {
      ...project,
      mergedSessionDirs: project.mergedSessionDirs
        ? [...project.mergedSessionDirs]
        : undefined,
    };
  }

  private handleFileChange(event: FileChangeEvent): void {
    if (event.fileType !== "session" && event.fileType !== "agent-session") {
      return;
    }

    // Any session file delta can affect project existence/count/lastActivity.
    this.invalidateCache();
  }

  private async scanProjects(): Promise<Project[]> {
    const projects: Project[] = [];
    const seenPaths = new Set<string>();

    // Codex projects are now the primary source of truth.
    if (this.codexScanner) {
      const codexProjects = await this.codexScanner.listProjects();
      for (const codexProject of codexProjects) {
        if (seenPaths.has(codexProject.path)) continue;
        seenPaths.add(codexProject.path);
        projects.push(codexProject);
      }
    }

    // Merge manually added projects (from ProjectMetadataService)
    if (this.projectMetadataService) {
      const addedProjects = this.projectMetadataService.getAllProjects();
      for (const [projectId, metadata] of Object.entries(addedProjects)) {
        // Skip if we've already seen this path from another source
        if (seenPaths.has(metadata.path)) continue;

        // Verify the directory still exists
        try {
          const stats = await stat(metadata.path);
          if (!stats.isDirectory()) continue;
        } catch {
          // Directory no longer exists, skip it
          continue;
        }

        seenPaths.add(metadata.path);
        projects.push({
          id: projectId as UrlProjectId,
          path: metadata.path,
          name: basename(metadata.path),
          sessionCount: 0,
          sessionDir: CODEX_SESSIONS_DIR,
          activeOwnedCount: 0,
          activeExternalCount: 0,
          lastActivity: metadata.addedAt,
          provider: "codex",
        });
      }
    }

    return projects;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const snapshot = await this.getSnapshot();
    const project = snapshot.byId.get(projectId);
    return project ? this.cloneProject(project) : null;
  }

  /**
   * Get a project by ID, or create a virtual project entry if the path exists on disk
   * but hasn't been used with Codex yet.
   *
   * This allows starting sessions in new directories without requiring prior Codex usage.
   */
  async getOrCreateProject(
    projectId: string,
    preferredProvider?: "codex" | "codex-oss",
  ): Promise<Project | null> {
    // First check if project already exists
    const existing = await this.getProject(projectId);
    if (existing) return existing;

    // Decode the projectId to get the path
    let projectPath: string;
    try {
      projectPath = decodeProjectId(projectId as UrlProjectId);
    } catch {
      return null;
    }

    // Validate path is absolute
    if (!isAbsolutePath(projectPath)) {
      return null;
    }

    // Check if the directory exists on disk
    try {
      const stats = await stat(projectPath);
      if (!stats.isDirectory()) {
        return null;
      }
    } catch {
      return null;
    }

    // Determine runtime: use preferred if specified, otherwise default to Codex.
    let provider = preferredProvider ?? DEFAULT_PROVIDER;
    if (!preferredProvider) {
      if (this.codexScanner) {
        const codexSessions =
          await this.codexScanner.getSessionsForProject(projectPath);
        if (codexSessions.length > 0) {
          provider = "codex";
        }
      }
    }

    return {
      id: projectId as UrlProjectId,
      path: projectPath,
      name: basename(projectPath),
      sessionCount: 0,
      sessionDir: CODEX_SESSIONS_DIR,
      activeOwnedCount: 0,
      activeExternalCount: 0,
      lastActivity: null,
      provider,
    };
  }

  /**
   * Find a project by matching the session directory suffix.
   *
   * This is used by ExternalSessionTracker which extracts the directory-based
   * project identifier from file paths (e.g., "-home-user-project" or
   * "hostname/-home-user-project") rather than the base64url-encoded projectId.
   */
  async getProjectBySessionDirSuffix(
    dirSuffix: string,
  ): Promise<Project | null> {
    const snapshot = await this.getSnapshot();
    const normalizedSuffix = this.normalizeDirSuffix(dirSuffix);
    const project = snapshot.bySessionDirSuffix.get(normalizedSuffix);
    return project ? this.cloneProject(project) : null;
  }

  dispose(): void {
    this.unsubscribeEventBus?.();
    this.unsubscribeEventBus = null;
  }

  /**
   * Get project info from a session directory in a single readdir pass.
   * Uses directory mtime as a cheap proxy for lastActivity (one stat
   * on the dir itself instead of stat-ing every session file).
   */
  private async getProjectDirInfo(projectDirPath: string): Promise<{
    projectPath: string;
    sessionCount: number;
    lastActivity: string | null;
  } | null> {
    try {
      const files = await readdir(projectDirPath);
      const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

      if (jsonlFiles.length === 0) return null;

      // Count non-agent sessions
      const sessionCount = jsonlFiles.filter(
        (f) => !f.startsWith("agent-"),
      ).length;

      // Use directory mtime as lastActivity (updated when files are added/removed)
      const dirStat = await stat(projectDirPath);
      const lastActivity = new Date(dirStat.mtimeMs).toISOString();

      // Read cwd from first available session file
      for (const file of jsonlFiles) {
        const filePath = join(projectDirPath, file);
        const cwd = await readCwdFromSessionFile(filePath);
        if (cwd) {
          return { projectPath: cwd, sessionCount, lastActivity };
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}

// Singleton for convenience
export const projectScanner = new ProjectScanner();
