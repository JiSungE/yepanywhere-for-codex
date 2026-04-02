import type {
  CodexCompactedEntry,
  CodexCustomToolCallOutputPayload,
  CodexCustomToolCallPayload,
  CodexEventMsgEntry,
  CodexFunctionCallPayload,
  CodexMessagePayload,
  CodexReasoningPayload,
  CodexResponseItemEntry,
  CodexSessionEntry,
  CodexWebSearchCallPayload,
} from "@yep-anywhere/shared";
import {
  isCodexCorrelationDebugEnabled,
  logCodexCorrelationDebug,
  summarizeCodexNormalizedMessage,
} from "../codex/correlationDebugLogger.js";
import {
  type CodexToolCallContext,
  canonicalizeCodexToolName,
  normalizeCodexToolInvocation,
  normalizeCodexToolOutputWithContext,
  parseCodexToolArguments,
} from "../codex/normalization.js";
import type { ContentBlock, Message, Session } from "../supervisor/types.js";
import type { LoadedSession } from "./types.js";

interface CodexToolUseConversion {
  callId: string;
  message: Message;
  context: CodexToolCallContext;
}

/**
 * Normalize a UnifiedSession into the generic Session format expected by the frontend.
 */
export function normalizeSession(loaded: LoadedSession): Session {
  const { summary, data } = loaded;

  switch (data.provider) {
    case "codex":
    case "codex-oss":
      return {
        ...summary,
        messages: convertCodexEntries(data.session.entries, summary.id),
      };
  }

  throw new Error(`Unsupported session provider: ${String((data as { provider?: unknown }).provider)}`);
}

// --- Codex Conversion Logic ---

export function convertCodexEntries(
  entries: CodexSessionEntry[],
  sessionId: string,
): Message[] {
  const messages: Message[] = [];
  let messageIndex = 0;
  const hasResponseItemUser = hasCodexResponseItemUserMessages(entries);
  const toolCallContexts = new Map<string, CodexToolCallContext>();

  for (const entry of entries) {
    if (entry.type === "response_item") {
      const msg = convertCodexResponseItem(
        entry,
        messageIndex++,
        toolCallContexts,
      );
      if (msg) {
        if (isCodexCorrelationDebugEnabled()) {
          logCodexCorrelationDebug({
            sessionId,
            channel: "jsonl",
            authority: "durable",
            entryType: entry.type,
            payloadType: entry.payload.type,
            eventKind: getCodexResponseEventKind(entry.payload),
            callId: getCodexResponsePayloadCallId(entry.payload),
            itemId: getCodexResponsePayloadItemId(entry.payload),
            ...summarizeCodexNormalizedMessage(msg),
          });
        }
        messages.push(msg);
      }
    } else if (entry.type === "compacted") {
      const msg = convertCodexCompactedEntry(entry, messageIndex++);
      if (msg) {
        if (isCodexCorrelationDebugEnabled()) {
          logCodexCorrelationDebug({
            sessionId,
            channel: "jsonl",
            authority: "durable",
            entryType: entry.type,
            eventKind: "context_compacted",
            ...summarizeCodexNormalizedMessage(msg),
          });
        }
        messages.push(msg);
      }
    } else if (entry.type === "event_msg") {
      const shouldIncludeUserMessage =
        entry.payload.type === "user_message" && !hasResponseItemUser;
      const shouldIncludeTurnAborted = entry.payload.type === "turn_aborted";
      const shouldIncludeContextCompacted =
        entry.payload.type === "context_compacted";
      // Skip agent_message and agent_reasoning events when response_item exists;
      // those are streaming artifacts that duplicate full response data.
      if (
        shouldIncludeUserMessage ||
        shouldIncludeTurnAborted ||
        shouldIncludeContextCompacted
      ) {
        const msg = convertCodexEventMsg(entry, messageIndex++);
        if (msg) {
          if (isCodexCorrelationDebugEnabled()) {
            logCodexCorrelationDebug({
              sessionId,
              channel: "jsonl",
              authority: "durable",
              entryType: entry.type,
              payloadType: entry.payload.type,
              eventKind: entry.payload.type,
              turnId: getCodexEventPayloadTurnId(entry.payload),
              itemId: getCodexEventPayloadItemId(entry.payload),
              ...summarizeCodexNormalizedMessage(msg),
            });
          }
          messages.push(msg);
        }
      }
    }
  }

  return messages;
}

function getCodexResponseEventKind(
  payload: CodexResponseItemEntry["payload"],
): string {
  if (payload.type === "message") {
    return payload.role === "assistant" ? "assistant_message" : "user_message";
  }
  return payload.type;
}

function getCodexResponsePayloadCallId(
  payload: CodexResponseItemEntry["payload"],
): string | undefined {
  switch (payload.type) {
    case "function_call":
    case "function_call_output":
      return payload.call_id;
    case "custom_tool_call":
    case "custom_tool_call_output":
    case "web_search_call":
      return typeof payload.call_id === "string"
        ? payload.call_id
        : typeof payload.id === "string"
          ? payload.id
          : undefined;
    default:
      return undefined;
  }
}

function getCodexResponsePayloadItemId(
  payload: CodexResponseItemEntry["payload"],
): string | undefined {
  switch (payload.type) {
    case "function_call":
    case "function_call_output":
      return payload.call_id;
    case "custom_tool_call":
    case "custom_tool_call_output":
    case "web_search_call":
      return typeof payload.id === "string"
        ? payload.id
        : typeof payload.call_id === "string"
          ? payload.call_id
          : undefined;
    default:
      return undefined;
  }
}

function getCodexEventPayloadTurnId(
  payload: CodexEventMsgEntry["payload"],
): string | undefined {
  return "turn_id" in payload && typeof payload.turn_id === "string"
    ? payload.turn_id
    : undefined;
}

function getCodexEventPayloadItemId(
  payload: CodexEventMsgEntry["payload"],
): string | undefined {
  if (payload.type !== "item_completed") {
    return undefined;
  }

  if (!payload.item || typeof payload.item !== "object") {
    return undefined;
  }

  const item = payload.item as { id?: unknown };
  return typeof item.id === "string" ? item.id : undefined;
}

function hasCodexResponseItemUserMessages(
  entries: CodexSessionEntry[],
): boolean {
  return entries.some(
    (entry) =>
      entry.type === "response_item" &&
      entry.payload.type === "message" &&
      entry.payload.role === "user",
  );
}

function convertCodexResponseItem(
  entry: CodexResponseItemEntry,
  index: number,
  toolCallContexts: Map<string, CodexToolCallContext>,
): Message | null {
  const payload = entry.payload;
  const uuid = `codex-${index}-${entry.timestamp}`;

  switch (payload.type) {
    case "message":
      if (payload.role === "developer") {
        return null;
      }
      return convertCodexMessagePayload(payload, uuid, entry.timestamp);

    case "reasoning":
      return convertCodexReasoningPayload(payload, uuid, entry.timestamp);

    case "function_call": {
      const converted = convertCodexFunctionCallPayload(
        payload,
        uuid,
        entry.timestamp,
      );
      toolCallContexts.set(converted.callId, converted.context);
      return converted.message;
    }

    case "function_call_output":
      return convertCodexToolCallOutputPayload(
        payload.call_id,
        payload.output,
        uuid,
        entry.timestamp,
        toolCallContexts.get(payload.call_id),
      );

    case "custom_tool_call": {
      const converted = convertCodexCustomToolCallPayload(
        payload,
        uuid,
        entry.timestamp,
      );
      toolCallContexts.set(converted.callId, converted.context);
      return converted.message;
    }

    case "custom_tool_call_output": {
      const customCallId = payload.call_id ?? `${uuid}-custom-tool-result`;
      return convertCodexToolCallOutputPayload(
        customCallId,
        payload.output,
        uuid,
        entry.timestamp,
        toolCallContexts.get(customCallId),
      );
    }

    case "web_search_call":
      return convertCodexWebSearchCallPayload(payload, uuid, entry.timestamp);

    case "ghost_snapshot":
      return null;

    default:
      return null;
  }
}

function convertCodexMessagePayload(
  payload: CodexMessagePayload,
  uuid: string,
  timestamp: string,
): Message {
  const content: ContentBlock[] = [];

  const fullText = payload.content
    .map((block) =>
      "text" in block && typeof block.text === "string" ? block.text : "",
    )
    .join("");
  if (fullText.trim()) {
    content.push({
      type: "text",
      text: fullText,
    });
  }

  for (const block of payload.content) {
    if (block.type !== "input_image") continue;
    content.push(normalizeCodexInputImageBlock(block));
  }

  if (content.length === 0) {
    return {
      uuid,
      type: payload.role,
      message: {
        role: payload.role,
        content: [],
      },
      timestamp,
    };
  }

  return {
    uuid,
    type: payload.role,
    message: {
      role: payload.role,
      content,
    },
    timestamp,
  };
}

function convertCodexReasoningPayload(
  payload: CodexReasoningPayload,
  uuid: string,
  timestamp: string,
): Message {
  const summaryText = payload.summary
    ?.map((s) => s.text)
    .join("\n")
    .trim();

  const content: ContentBlock[] = [];

  if (summaryText) {
    content.push({
      type: "thinking",
      thinking: summaryText,
    });
  }

  if (payload.encrypted_content && !summaryText) {
    content.push({
      type: "thinking",
      thinking: "Reasoning [internal]",
    });
  }

  return {
    uuid,
    type: "assistant",
    message: {
      role: "assistant",
      content,
    },
    timestamp,
  };
}

type CodexInputImageBlock = Extract<
  CodexMessagePayload["content"][number],
  { type: "input_image" }
>;

function normalizeCodexInputImageBlock(
  block: CodexInputImageBlock,
): ContentBlock {
  const normalized: ContentBlock = { type: "input_image" };

  const filePath =
    typeof block.file_path === "string" ? block.file_path.trim() : "";
  if (filePath) {
    normalized.file_path = filePath;
  }

  const mimeType = resolveCodexInputImageMimeType(block);
  if (mimeType) {
    normalized.mime_type = mimeType;
  }

  const imageUrl =
    typeof block.image_url === "string" ? block.image_url.trim() : "";
  if (imageUrl && !isDataUrl(imageUrl)) {
    normalized.image_url = imageUrl;
  }

  return normalized;
}

function resolveCodexInputImageMimeType(
  block: CodexInputImageBlock,
): string | undefined {
  const explicitMime =
    typeof block.mime_type === "string" ? block.mime_type.trim() : "";
  if (explicitMime) {
    return explicitMime;
  }

  if (typeof block.image_url !== "string") {
    return undefined;
  }

  const dataUrlMime = parseDataUrlMimeType(block.image_url);
  return dataUrlMime || undefined;
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

function parseDataUrlMimeType(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return match?.[1] ?? null;
}

function convertCodexFunctionCallPayload(
  payload: CodexFunctionCallPayload,
  uuid: string,
  timestamp: string,
): CodexToolUseConversion {
  const rawToolName = payload.name;
  const canonicalToolName = canonicalizeCodexToolName(rawToolName);
  const parsedInput = parseCodexToolArguments(payload.arguments);
  const normalizedInvocation = normalizeCodexToolInvocation(
    canonicalToolName,
    parsedInput,
  );

  const content: ContentBlock[] = [
    {
      type: "tool_use",
      id: payload.call_id,
      name: normalizedInvocation.toolName,
      input: normalizedInvocation.input,
    },
  ];

  const message: Message = {
    uuid,
    type: "assistant",
    message: {
      role: "assistant",
      content,
    },
    codexToolName: rawToolName,
    timestamp,
  };

  return {
    callId: payload.call_id,
    message,
    context: {
      toolName: normalizedInvocation.toolName,
      input: normalizedInvocation.input,
      readShellInfo: normalizedInvocation.readShellInfo,
      writeShellInfo: normalizedInvocation.writeShellInfo,
    },
  };
}

function convertCodexCustomToolCallPayload(
  payload: CodexCustomToolCallPayload,
  uuid: string,
  timestamp: string,
): CodexToolUseConversion {
  const callId = payload.call_id ?? payload.id ?? `${uuid}-custom-tool`;
  const rawToolName = payload.name ?? "custom_tool_call";
  const canonicalToolName = canonicalizeCodexToolName(rawToolName);
  const rawInput =
    payload.input !== undefined
      ? payload.input
      : parseCodexToolArguments(payload.arguments);
  const normalizedInvocation = normalizeCodexToolInvocation(
    canonicalToolName,
    rawInput,
  );

  const content: ContentBlock[] = [
    {
      type: "tool_use",
      id: callId,
      name: normalizedInvocation.toolName,
      input: normalizedInvocation.input,
    },
  ];

  const message: Message = {
    uuid,
    type: "assistant",
    message: {
      role: "assistant",
      content,
    },
    codexToolName: rawToolName,
    timestamp,
  };

  return {
    callId,
    message,
    context: {
      toolName: normalizedInvocation.toolName,
      input: normalizedInvocation.input,
      readShellInfo: normalizedInvocation.readShellInfo,
      writeShellInfo: normalizedInvocation.writeShellInfo,
    },
  };
}

function convertCodexWebSearchCallPayload(
  payload: CodexWebSearchCallPayload,
  uuid: string,
  timestamp: string,
): Message {
  const callId = payload.call_id ?? payload.id ?? `${uuid}-web-search`;
  const rawToolName = payload.name ?? payload.type;
  const toolName = canonicalizeCodexToolName(rawToolName);

  const parsedArguments = parseCodexToolArguments(payload.arguments);
  let input: Record<string, unknown>;

  if (isRecord(payload.input)) {
    input = { ...payload.input };
  } else if (isRecord(parsedArguments)) {
    input = { ...parsedArguments };
  } else {
    input = {};
  }

  if (typeof payload.query === "string" && typeof input.query !== "string") {
    input.query = payload.query;
  }

  if (payload.action !== undefined && input.action === undefined) {
    input.action = payload.action;
  }

  const content: ContentBlock[] = [
    {
      type: "tool_use",
      id: callId,
      name: toolName,
      input,
    },
  ];

  return {
    uuid,
    type: "assistant",
    message: {
      role: "assistant",
      content,
    },
    codexToolName: rawToolName,
    timestamp,
  };
}

function convertCodexToolCallOutputPayload(
  callId: string,
  output: unknown,
  uuid: string,
  timestamp: string,
  context?: CodexToolCallContext,
): Message {
  const normalized = normalizeCodexToolOutputWithContext(output, context);
  const content = normalized.content;
  const structured = normalized.structured;
  const isError = normalized.isError;

  const toolResult: ContentBlock = {
    type: "tool_result",
    tool_use_id: callId,
    content,
    ...(isError && { is_error: true }),
  };

  return {
    uuid,
    type: "user",
    message: {
      role: "user",
      content: [toolResult],
    },
    ...(structured !== undefined && {
      toolUseResult: structured,
    }),
    timestamp,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function convertCodexCompactedEntry(
  entry: CodexCompactedEntry,
  index: number,
): Message {
  const uuid = `codex-compacted-${index}-${entry.timestamp}`;
  return {
    uuid,
    type: "system",
    subtype: "compact_boundary",
    content: entry.payload.message || "Context compacted",
    timestamp: entry.timestamp,
  };
}

function convertCodexEventMsg(
  entry: CodexEventMsgEntry,
  index: number,
): Message | null {
  const payload = entry.payload;
  const uuid = `codex-event-${index}-${entry.timestamp}`;

  switch (payload.type) {
    case "user_message":
      return {
        uuid,
        type: "user",
        message: {
          role: "user",
          content: payload.message,
        },
        timestamp: entry.timestamp,
      };

    case "agent_message":
      return {
        uuid,
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: payload.message }],
        },
        timestamp: entry.timestamp,
      };

    case "agent_reasoning":
      return {
        uuid,
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: payload.text }],
        },
        timestamp: entry.timestamp,
      };

    case "turn_aborted":
      return {
        uuid,
        type: "system",
        subtype: "turn_aborted",
        content: payload.reason ?? payload.message ?? "Turn aborted",
        timestamp: entry.timestamp,
      };

    case "context_compacted":
      return {
        uuid,
        type: "system",
        subtype: "compact_boundary",
        content: "Context compacted",
        timestamp: entry.timestamp,
      };

    case "item_completed":
      return null;

    default:
      return null;
  }
}
