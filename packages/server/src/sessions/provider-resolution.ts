import type { ProviderName, UrlProjectId } from "@yep-anywhere/shared";
import type { ISessionIndexService } from "../indexes/types.js";
import type { Project, SessionSummary } from "../supervisor/types.js";
import type { ISessionReader } from "./types.js";

export interface ProviderResolutionDeps {
  readerFactory: (project: Project) => ISessionReader;
  sessionIndexService?: ISessionIndexService;
  codexReaderFactory?: (projectPath: string) => ISessionReader;
}

export interface SessionSource {
  provider: ProviderName;
  reader: ISessionReader;
  sessionDir: string;
  kind: "codex";
}

export interface ResolvedSessionSummary {
  source: SessionSource;
  summary: SessionSummary;
}

function getSessionSource(
  project: Project,
  deps: ProviderResolutionDeps,
): SessionSource {
  return {
    provider: project.provider,
    reader: deps.codexReaderFactory?.(project.path) ?? deps.readerFactory(project),
    sessionDir: project.sessionDir,
    kind: "codex",
  };
}

async function listSessionsForSource(
  project: Project,
  source: SessionSource,
  deps: ProviderResolutionDeps,
): Promise<SessionSummary[]> {
  if (!deps.sessionIndexService) {
    return source.reader.listSessions(project.id);
  }

  return deps.sessionIndexService.getSessionsWithCache(
    source.sessionDir,
    project.id,
    source.reader,
  );
}

export async function listSessionsAcrossProviders(
  project: Project,
  deps: ProviderResolutionDeps,
): Promise<SessionSummary[]> {
  const source = getSessionSource(project, deps);
  return listSessionsForSource(project, source, deps);
}

export async function findSessionSummaryAcrossProviders(
  project: Project,
  sessionId: string,
  projectId: UrlProjectId,
  deps: ProviderResolutionDeps,
  _preferredProvider?: ProviderName | string,
): Promise<ResolvedSessionSummary | null> {
  const source = getSessionSource(project, deps);
  const summary = await source.reader.getSessionSummary(sessionId, projectId);
  return summary ? { source, summary } : null;
}
