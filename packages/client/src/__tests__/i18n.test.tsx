import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThinkingIndicator } from "../components/ThinkingIndicator";
import { I18nProvider, detectLocale } from "../i18n";
import de from "../i18n/de.json";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import fr from "../i18n/fr.json";
import ja from "../i18n/ja.json";
import ko from "../i18n/ko.json";
import zhCn from "../i18n/zh-CN.json";
import { AppearanceSettings } from "../pages/settings/AppearanceSettings";

const ALL_LOCALES = {
  en,
  "zh-CN": zhCn,
  es,
  fr,
  de,
  ja,
  ko,
};

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps all locale bundles in key parity with English", () => {
    const enKeys = Object.keys(en).sort();

    for (const [locale, messages] of Object.entries(ALL_LOCALES)) {
      expect(Object.keys(messages).sort(), locale).toEqual(enKeys);
    }
  });

  it("detects Korean from saved locale and browser locale", () => {
    localStorage.setItem("yep-anywhere-locale", "ko");
    expect(detectLocale()).toBe("ko");

    localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("ko-KR");
    expect(detectLocale()).toBe("ko");
  });

  it("renders Korean UI strings when the locale is ko", async () => {
    localStorage.setItem("yep-anywhere-locale", "ko");

    render(
      <I18nProvider>
        <ThinkingIndicator variant="pill" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("생각 중")).toBeTruthy();
    });
  });

  it("shows Korean in appearance language options and persists selection", async () => {
    render(
      <I18nProvider>
        <AppearanceSettings />
      </I18nProvider>,
    );

    const select = screen.getByRole("combobox", { name: "Language" });
    expect(
      within(select).getByRole("option", { name: "한국어" }).getAttribute("value"),
    ).toBe("ko");

    fireEvent.change(select, { target: { value: "ko" } });

    await waitFor(() => {
      expect(localStorage.getItem("yep-anywhere-locale")).toBe("ko");
      expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
        "ko",
      );
    });
  });
});
