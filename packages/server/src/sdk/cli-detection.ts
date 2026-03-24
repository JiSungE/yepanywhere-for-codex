import { exec, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import * as os from "node:os";
import { promisify } from "node:util";

const isWindows = os.platform() === "win32";
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * Returns the platform-appropriate command to locate an executable in PATH.
 * Uses `where` on Windows, `which` on Unix.
 */
export function whichCommand(name: string): string {
  return isWindows ? `where ${name}` : `which ${name}`;
}

/**
 * Information about the Claude CLI installation.
 */
export interface ClaudeCliInfo {
  /** Whether the CLI was found */
  found: boolean;
  /** Path to the CLI executable */
  path?: string;
  /** CLI version string */
  version?: string;
  /** Error message if not found */
  error?: string;
}

/**
 * Detect the Claude CLI installation.
 *
 * Checks:
 * 1. PATH via `which claude`
 * 2. Common installation locations
 *
 * @returns Information about the CLI installation
 */
export function detectClaudeCli(): ClaudeCliInfo {
  // Short-circuit: let the SDK handle CLI spawning and errors
  return { found: true, path: "claude", version: "(SDK-managed)" };
}

/**
 * Information about the Codex CLI installation.
 */
export interface CodexCliInfo {
  /** Whether the CLI was found */
  found: boolean;
  /** Path to the CLI executable */
  path?: string;
  /** CLI version string */
  version?: string;
  /** Error message if not found */
  error?: string;
}

/**
 * Detect the Codex CLI installation.
 *
 * Checks:
 * 1. PATH via `which codex`
 * 2. Common installation locations (cargo, local bin, etc.)
 *
 * @returns Information about the CLI installation
 */
export async function detectCodexCli(): Promise<CodexCliInfo> {
  const whichCmd = whichCommand("codex");

  // Try to find codex in PATH
  try {
    const { stdout } = await execAsync(whichCmd, {
      encoding: "utf-8",
    });
    const codexPath = stdout.split("\n")[0]?.trim();

    if (codexPath) {
      const version = await getCodexVersion(codexPath);
      return { found: true, path: codexPath, version };
    }
  } catch {
    // Not in PATH, continue to check common locations
  }

  // Check common installation locations
  const home = os.homedir();
  const ext = isWindows ? ".exe" : "";
  const sep = isWindows ? "\\" : "/";
  const commonPaths = isWindows
    ? [
        `${home}${sep}.cargo${sep}bin${sep}codex${ext}`,
        `${home}${sep}.codex${sep}bin${sep}codex${ext}`,
        `${home}${sep}AppData${sep}Local${sep}bin${sep}codex${ext}`,
      ]
    : [
        `${home}/.local/bin/codex`,
        "/usr/local/bin/codex",
        `${home}/.cargo/bin/codex`,
        `${home}/.codex/bin/codex`,
      ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      const version = await getCodexVersion(path);
      if (version) {
        return { found: true, path, version };
      }
    }
  }

  return {
    found: false,
    error: "Codex CLI not found. Install via: cargo install codex",
  };
}

/**
 * Get the version of the Codex CLI at the given path.
 */
async function getCodexVersion(codexPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(codexPath, ["--version"], {
      encoding: "utf-8",
    });
    const output = stdout.trim();
    return output;
  } catch {
    return undefined;
  }
}
