import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import {
  REQUEST_LOCALE_HEADER,
  normalizeServerLocale,
  translateUserMessage,
} from "../i18n.js";
import {
  allowAllHosts,
  isAllowedHost,
  isAllowedOrigin,
} from "./allowed-hosts.js";

/**
 * Host header validation middleware.
 * Protects against DNS rebinding attacks by ensuring the Host header
 * matches an allowed hostname. Skipped when ALLOWED_HOSTS=*.
 */
export const hostCheckMiddleware: MiddlewareHandler = async (c, next) => {
  if (allowAllHosts()) {
    await next();
    return;
  }
  const host = c.req.header("host");
  const locale = normalizeServerLocale(c.req.header(REQUEST_LOCALE_HEADER));
  if (!isAllowedHost(host)) {
    console.warn(`[Security] Rejected request with Host: ${host}`);
    const hostname = host ?? "(unknown)";
    const hostWithoutPort = hostname.replace(/:\d+$/, "");
    const lines =
      locale === "ko"
        ? [
            `차단된 요청: "${hostname}" 호스트는 허용 목록에 없습니다.`,
            "",
            "해결하려면 ALLOWED_HOSTS 환경 변수에 추가하세요:",
            "",
            `  ALLOWED_HOSTS=${hostWithoutPort}`,
            "",
            "또는 모든 호스트를 허용할 수 있습니다(보안 수준 낮음):",
            "",
            "  ALLOWED_HOSTS=*",
            "",
            "여러 호스트는 쉼표로 구분할 수 있습니다:",
            "",
            `  ALLOWED_HOSTS=${hostWithoutPort},other.example.com`,
          ]
        : [
            `Blocked request: "${hostname}" is not an allowed host.`,
            "",
            "To fix this, add it to the ALLOWED_HOSTS environment variable:",
            "",
            `  ALLOWED_HOSTS=${hostWithoutPort}`,
            "",
            "Or allow all hosts (less secure):",
            "",
            "  ALLOWED_HOSTS=*",
            "",
            "Multiple hosts can be comma-separated:",
            "",
            `  ALLOWED_HOSTS=${hostWithoutPort},other.example.com`,
          ];
    return c.text(lines.join("\n"), 403);
  }
  await next();
};

export const corsMiddleware = cors({
  origin: (origin) => (isAllowedOrigin(origin) ? origin : null),
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Yep-Anywhere",
    REQUEST_LOCALE_HEADER,
  ],
});

// Only require header on mutating requests (SSE uses native EventSource which can't send headers)
export const requireCustomHeader: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (c.req.header("X-Yep-Anywhere") !== "true") {
      const locale = normalizeServerLocale(c.req.header(REQUEST_LOCALE_HEADER));
      return c.json(
        { error: translateUserMessage("Missing required header", locale) },
        403,
      );
    }
  }
  await next();
};
