import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import enMessages from "./i18n/en.json";
import { UI_KEYS } from "./lib/storageKeys";

export const SUPPORTED_LOCALES = [
  "en",
  "zh-CN",
  "es",
  "fr",
  "de",
  "ja",
  "ko",
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationVars = Record<string, string | number>;
export type TranslateFn = (key: MessageKey, vars?: TranslationVars) => string;

const DEFAULT_LOCALE: Locale = "en";

const defaultMessages = enMessages;
type Messages = typeof defaultMessages;
type MessageKey = keyof Messages;

const localeLoaders: Record<Locale, () => Promise<Messages>> = {
  en: async () => defaultMessages,
  "zh-CN": async () => (await import("./i18n/zh-CN.json")).default,
  es: async () => (await import("./i18n/es.json")).default,
  fr: async () => (await import("./i18n/fr.json")).default,
  de: async () => (await import("./i18n/de.json")).default,
  ja: async () => (await import("./i18n/ja.json")).default,
  ko: async () => (await import("./i18n/ko.json")).default,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  formatDate: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatTime: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatDateTime: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function translateMessage(
  activeMessages: Messages,
  key: MessageKey,
  vars?: TranslationVars,
): string {
  let text = String(activeMessages[key] ?? defaultMessages[key]);
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

const fallbackI18nContext: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, vars) => translateMessage(defaultMessages, key, vars),
  formatDate: (value, options) =>
    new Intl.DateTimeFormat(getIntlLocale(DEFAULT_LOCALE), options).format(
      new Date(value),
    ),
  formatTime: (value, options) =>
    new Intl.DateTimeFormat(getIntlLocale(DEFAULT_LOCALE), {
      hour: "numeric",
      minute: "2-digit",
      ...options,
    }).format(new Date(value)),
  formatDateTime: (value, options) =>
    new Intl.DateTimeFormat(getIntlLocale(DEFAULT_LOCALE), options).format(
      new Date(value),
    ),
  formatNumber: (value, options) =>
    new Intl.NumberFormat(getIntlLocale(DEFAULT_LOCALE), options).format(value),
};

function isLocale(value: string | null): value is Locale {
  return value !== null && SUPPORTED_LOCALES.includes(value as Locale);
}

function getStoredLocale(): string | null {
  if (
    typeof localStorage === "undefined" ||
    typeof localStorage.getItem !== "function"
  ) {
    return null;
  }
  return localStorage.getItem(UI_KEYS.locale);
}

function getBrowserLocale(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }
  return navigator.language.toLowerCase();
}

export function detectLocale(): Locale {
  const stored =
    typeof localStorage !== "undefined" &&
    typeof localStorage.getItem === "function"
      ? getStoredLocale()
      : null;
  if (isLocale(stored)) return stored;
  const browserLocale = getBrowserLocale();
  if (browserLocale.startsWith("zh")) return "zh-CN";
  if (browserLocale.startsWith("es")) return "es";
  if (browserLocale.startsWith("fr")) return "fr";
  if (browserLocale.startsWith("de")) return "de";
  if (browserLocale.startsWith("ja")) return "ja";
  if (browserLocale.startsWith("ko")) return "ko";
  return DEFAULT_LOCALE;
}

export function getRequestLocale(): Locale {
  return detectLocale();
}

export function getIntlLocale(locale: Locale): string {
  return locale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const [messages, setMessages] = useState<Partial<Record<Locale, Messages>>>({
    en: defaultMessages,
  });

  useEffect(() => {
    if (
      typeof localStorage !== "undefined" &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem(UI_KEYS.locale, locale);
    }
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (messages[locale]) return;

    let cancelled = false;

    void localeLoaders[locale]().then((loadedMessages) => {
      if (cancelled) return;
      setMessages((current) => ({ ...current, [locale]: loadedMessages }));
    });

    return () => {
      cancelled = true;
    };
  }, [locale, messages]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key, vars) =>
        translateMessage(messages[locale] ?? defaultMessages, key, vars),
      formatDate: (value, options) =>
        new Intl.DateTimeFormat(getIntlLocale(locale), options).format(
          new Date(value),
        ),
      formatTime: (value, options) =>
        new Intl.DateTimeFormat(getIntlLocale(locale), {
          hour: "numeric",
          minute: "2-digit",
          ...options,
        }).format(new Date(value)),
      formatDateTime: (value, options) =>
        new Intl.DateTimeFormat(getIntlLocale(locale), options).format(
          new Date(value),
        ),
      formatNumber: (value, options) =>
        new Intl.NumberFormat(getIntlLocale(locale), options).format(value),
    }),
    [locale, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function useOptionalI18n() {
  return useContext(I18nContext) ?? fallbackI18nContext;
}
