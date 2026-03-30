import type { TranslateFn } from "../../i18n";
import { getDisplayBashCommandFromInput } from "../../lib/bashCommand";
import type { ToolResultData } from "../../types/renderItems";
import { toolRegistry } from "../renderers/tools";

/**
 * Safely call a renderer method, falling back to undefined on error.
 * This handles cases where tool input/result doesn't match expected schema
 * (e.g., Gemini using different field names than Claude SDK).
 */
function safeCall<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * Get a summary string for a tool call based on its status.
 *
 * Uses the tool registry's getUseSummary and getResultSummary methods when available,
 * falling back to sensible defaults.
 */
export function getToolSummary(
  toolName: string,
  input: unknown,
  result: ToolResultData | undefined,
  status: "pending" | "complete" | "error" | "aborted",
  t?: TranslateFn,
): string {
  const renderer = toolRegistry.get(toolName);

  if (status === "pending" || status === "aborted") {
    // Show input summary while pending or aborted (no result available)
    if (renderer.getUseSummary) {
      const summary = safeCall(() => renderer.getUseSummary?.(input));
      if (summary !== undefined) return summary;
    }
    return getDefaultInputSummary(toolName, input, t);
  }

  // Show result summary when complete or error
  // For some tools, combine input + result for a complete summary
  let inputSummary: string;
  if (renderer.getUseSummary) {
    const summary = safeCall(() => renderer.getUseSummary?.(input));
    inputSummary = summary ?? getDefaultInputSummary(toolName, input, t);
  } else {
    inputSummary = getDefaultInputSummary(toolName, input, t);
  }

  let resultSummary: string;
  if (renderer.getResultSummary) {
    const summary = safeCall(() =>
      renderer.getResultSummary?.(
        result?.structured ?? result?.content,
        result?.isError ?? false,
        input,
      ),
    );
    resultSummary =
      summary ?? getDefaultResultSummary(toolName, result, status, t);
  } else {
    resultSummary = getDefaultResultSummary(toolName, result, status, t);
  }

  // Combine input and result for tools where the input context is valuable
  if (toolName === "Glob" || toolName === "Grep") {
    return `${inputSummary} → ${resultSummary}`;
  }

  // For Bash, always show description (input summary) since output is in collapsed preview
  if (toolName === "Bash") {
    return inputSummary;
  }

  if (toolName === "WriteStdin") {
    if (inputSummary && inputSummary !== "waiting for output") {
      return `${inputSummary} → ${resultSummary}`;
    }
    return resultSummary;
  }

  return resultSummary;
}

/**
 * Default input summary when renderer doesn't provide one.
 * Handles both Claude SDK field names and generic fallback for other providers.
 */
function getDefaultInputSummary(
  toolName: string,
  input: unknown,
  t?: TranslateFn,
): string {
  // Guard against null/undefined input
  if (!input || typeof input !== "object") {
    return t?.("toolSummaryEllipsis") ?? "...";
  }

  const i = input as Record<string, unknown>;

  // Try Claude SDK field names first, then fall back to generic
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      if (typeof i.file_path === "string") return getFileName(i.file_path);
      break;
    case "Bash":
      {
        const command = getDisplayBashCommandFromInput(i);
        if (command) return command;
      }
      break;
    case "Glob":
      if (typeof i.pattern === "string") return i.pattern;
      break;
    case "Grep":
      if (typeof i.pattern === "string") return `"${i.pattern}"`;
      break;
    case "Task":
    case "Agent":
      if (typeof i.description === "string") return truncate(i.description, 30);
      break;
    case "WebSearch":
      if (typeof i.query === "string") return truncate(i.query, 30);
      break;
    case "WebFetch":
      if (typeof i.url === "string") return truncate(i.url, 40);
      break;
  }

  // Fallback: try to find first meaningful string property to show
  return getFirstStringValue(i, t);
}

/**
 * Get the first short string value from an object for fallback display.
 * Useful for unknown tool inputs from non-Claude providers.
 */
function getFirstStringValue(
  obj: Record<string, unknown>,
  t?: TranslateFn,
): string {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && value.length > 0 && value.length < 100) {
      return truncate(value, 40);
    }
  }
  return t?.("toolSummaryEllipsis") ?? "...";
}

/**
 * Default result summary when renderer doesn't provide one
 */
function getDefaultResultSummary(
  toolName: string,
  result: ToolResultData | undefined,
  status: "pending" | "complete" | "error",
  t?: TranslateFn,
): string {
  if (status === "error") {
    return t?.("toolSummaryFailed") ?? "failed";
  }

  if (!result) {
    return t?.("toolSummaryDone") ?? "done";
  }

  // Try to extract meaningful info from content
  // Guard against non-string content (can happen with some tool results)
  const content = typeof result.content === "string" ? result.content : "";
  const lineCount = content.split("\n").filter(Boolean).length;

  switch (toolName) {
    case "Read":
      return (
        t?.("toolSummaryLines", { count: lineCount }) ?? `${lineCount} lines`
      );
    case "Bash":
      return (
        t?.("toolSummaryLines", { count: lineCount }) ?? `${lineCount} lines`
      );
    case "Glob":
      return (
        t?.("toolSummaryFiles", { count: lineCount }) ?? `${lineCount} files`
      );
    case "Grep":
      return (
        t?.("toolSummaryMatches", { count: lineCount }) ??
        `${lineCount} matches`
      );
    default:
      return t?.("toolSummaryDone") ?? "done";
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}
