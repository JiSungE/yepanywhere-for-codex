import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  REQUEST_LOCALE_HEADER,
  localizeJsonResponses,
  normalizeServerLocale,
  translateUserMessage,
} from "../src/i18n.js";

describe("server i18n", () => {
  it("normalizes Korean locale variants", () => {
    expect(normalizeServerLocale("ko")).toBe("ko");
    expect(normalizeServerLocale("ko-KR")).toBe("ko");
    expect(normalizeServerLocale("en-US")).toBe("en");
  });

  it("translates known user-facing messages", () => {
    expect(translateUserMessage("Missing required header", "ko")).toBe(
      "필수 헤더가 없습니다.",
    );
    expect(translateUserMessage("Missing required header", "en")).toBe(
      "Missing required header",
    );
  });

  it("localizes JSON error responses when Korean is requested", async () => {
    const app = new Hono();
    app.use("*", localizeJsonResponses);
    app.get("/error", (c) =>
      c.json(
        {
          error: "Authentication required",
          details: { message: "Session expired" },
        },
        401,
      ),
    );

    const res = await app.request("/error", {
      headers: {
        [REQUEST_LOCALE_HEADER]: "ko",
      },
    });
    const json = await res.json();

    expect(json.error).toBe("인증이 필요합니다.");
    expect(json.details.message).toBe("세션이 만료되었습니다.");
  });
});
