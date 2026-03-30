import type { MiddlewareHandler } from "hono";

export const REQUEST_LOCALE_HEADER = "X-Yep-Anywhere-Locale";

export type ServerLocale = "en" | "ko";

const KO_MESSAGE_MAP: Record<string, string> = {
  "Authentication required": "인증이 필요합니다.",
  "Session expired": "세션이 만료되었습니다.",
  "Password is required": "비밀번호가 필요합니다.",
  "Password must be at least 6 characters": "비밀번호는 6자 이상이어야 합니다.",
  "Password must be at least 8 characters": "비밀번호는 8자 이상이어야 합니다.",
  "Failed to enable auth": "인증을 활성화하지 못했습니다.",
  "Not authenticated": "인증되지 않았습니다.",
  "Account already exists": "계정이 이미 존재합니다.",
  "Failed to create account": "계정을 생성하지 못했습니다.",
  "Invalid password": "비밀번호가 올바르지 않습니다.",
  "New password is required": "새 비밀번호가 필요합니다.",
  "Failed to change password": "비밀번호를 변경하지 못했습니다.",
  "open must be a boolean": "open 값은 boolean이어야 합니다.",
  "Missing required header": "필수 헤더가 없습니다.",
  "Internal server error": "서버 내부 오류가 발생했습니다.",
  "Invalid project ID": "유효하지 않은 프로젝트 ID입니다.",
  "Invalid project ID format": "프로젝트 ID 형식이 올바르지 않습니다.",
  "Project not found": "프로젝트를 찾을 수 없습니다.",
  "Project not found or path does not exist":
    "프로젝트를 찾을 수 없거나 경로가 존재하지 않습니다.",
  "Invalid filename": "파일 이름이 올바르지 않습니다.",
  "Invalid path": "경로가 올바르지 않습니다.",
  "Missing path parameter": "path 파라미터가 필요합니다.",
  "Path must be absolute": "절대 경로여야 합니다.",
  "Path is not a file": "경로가 파일이 아닙니다.",
  "Path not in allowed directories": "허용된 디렉터리 경로가 아닙니다.",
  "Invalid file path": "파일 경로가 올바르지 않습니다.",
  "File not found": "파일을 찾을 수 없습니다.",
  "Not a file": "파일이 아닙니다.",
  "Failed to read file": "파일을 읽지 못했습니다.",
  "Invalid JSON body": "JSON 본문이 올바르지 않습니다.",
  "Process not found": "프로세스를 찾을 수 없습니다.",
  "Interrupt not supported for this process":
    "이 프로세스에서는 중단을 지원하지 않습니다.",
  "Session not found": "세션을 찾을 수 없습니다.",
  "Agent session not found": "에이전트 세션을 찾을 수 없습니다.",
  "No active process for session": "세션에 활성 프로세스가 없습니다.",
  "sessionId required for session channel":
    "세션 채널에는 sessionId 값이 필요합니다.",
  "Deferred message not found": "지연된 메시지를 찾을 수 없습니다.",
  "mode is required": "mode 값이 필요합니다.",
  "hold is required (boolean)": "hold 값이 필요합니다 (boolean).",
  "No pending input request": "대기 중인 입력 요청이 없습니다.",
  "requestId and response are required":
    "requestId와 response 값이 필요합니다.",
  "Invalid request ID or no pending request":
    "request ID가 올바르지 않거나 대기 중인 요청이 없습니다.",
  "Notification service not available": "알림 서비스를 사용할 수 없습니다.",
  "Session metadata service not available":
    "세션 메타데이터 서비스를 사용할 수 없습니다.",
  "Session directory not found": "세션 디렉터리를 찾을 수 없습니다.",
  "Codex session reader not available": "Codex 세션 리더를 사용할 수 없습니다.",
  "Session file not found": "세션 파일을 찾을 수 없습니다.",
  "Queue entry not found": "큐 항목을 찾을 수 없습니다.",
  "entries must be a non-empty array":
    "entries는 비어 있지 않은 배열이어야 합니다.",
  "sessionId and projectId are required":
    "sessionId와 projectId 값이 필요합니다.",
  "Provider not found": "프로바이더를 찾을 수 없습니다.",
  "Sharing not configured": "공유 설정이 구성되지 않았습니다.",
  "html is required": "html 값이 필요합니다.",
  "Invalid newSessionDefaults setting":
    "newSessionDefaults 설정이 올바르지 않습니다.",
  "At least one valid setting is required":
    "유효한 설정이 하나 이상 필요합니다.",
  "executors must be an array": "executors는 배열이어야 합니다.",
  "host is required": "host 값이 필요합니다.",
  "host must be a valid SSH host alias":
    "host는 유효한 SSH 호스트 별칭이어야 합니다.",
  "markdown is required": "markdown 값이 필요합니다.",
  "Message is required": "메시지가 필요합니다.",
  "browserProfileId is required": "browserProfileId 값이 필요합니다.",
  "Valid subscription object is required":
    "유효한 subscription 객체가 필요합니다.",
  "Subscription not found": "구독을 찾을 수 없습니다.",
  "URL and username are required": "URL과 username 값이 필요합니다.",
  "Session service not available": "세션 서비스를 사용할 수 없습니다.",
  "Not a recognized image type": "인식 가능한 이미지 형식이 아닙니다.",
  "path is required": "path 값이 필요합니다.",
  "Remote access not configured": "원격 액세스가 구성되지 않았습니다.",
  "Unknown identity": "알 수 없는 사용자입니다.",
  "Authentication already in progress": "인증이 이미 진행 중입니다.",
  "Already authenticated": "이미 인증되었습니다.",
  "Authentication failed": "인증에 실패했습니다.",
  "Too many authentication attempts. Try again shortly.":
    "인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
  "Unexpected proof message": "예상하지 못한 proof 메시지입니다.",
};

export function normalizeServerLocale(
  value: string | null | undefined,
): ServerLocale {
  if (!value) return "en";
  const normalized = value.toLowerCase();
  return normalized === "ko" || normalized.startsWith("ko-") ? "ko" : "en";
}

export function translateUserMessage(
  message: string,
  locale: ServerLocale,
): string {
  if (locale !== "ko") {
    return message;
  }
  return KO_MESSAGE_MAP[message] ?? message;
}

function translateJsonPayload(payload: unknown, locale: ServerLocale): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => translateJsonPayload(item, locale));
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if ((key === "error" || key === "message") && typeof value === "string") {
      translated[key] = translateUserMessage(value, locale);
    } else {
      translated[key] = translateJsonPayload(value, locale);
    }
  }
  return translated;
}

export const localizeJsonResponses: MiddlewareHandler = async (c, next) => {
  const locale = normalizeServerLocale(c.req.header(REQUEST_LOCALE_HEADER));
  await next();

  if (locale === "en") {
    return;
  }

  const contentType = c.res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return;
  }

  try {
    const translatedPayload = translateJsonPayload(
      await c.res.clone().json(),
      locale,
    );
    const headers = new Headers(c.res.headers);
    headers.delete("content-length");
    c.res = new Response(JSON.stringify(translatedPayload), {
      status: c.res.status,
      headers,
    });
  } catch {
    // Ignore non-JSON/streamed responses that cannot be cloned or parsed.
  }
};
