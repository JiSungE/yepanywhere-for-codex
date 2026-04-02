import type {
  ReasoningEffortLevel,
  ThinkingMode,
  ThinkingOption,
} from "@yep-anywhere/shared";
import { useCallback, useState } from "react";
import {
  LEGACY_KEYS,
  getServerScoped,
  setServerScoped,
} from "../lib/storageKeys";

export const DEFAULT_MODEL_SETTING = "default";
export const DEFAULT_REASONING_EFFORT: ReasoningEffortLevel = "medium";

export const REASONING_EFFORT_OPTIONS: {
  value: ReasoningEffortLevel;
  label: string;
  description: string;
}[] = [
  { value: "low", label: "Low", description: "Fastest responses" },
  { value: "medium", label: "Medium", description: "Balanced reasoning" },
  { value: "high", label: "High", description: "Deeper reasoning" },
  { value: "xhigh", label: "Very high", description: "Maximum reasoning" },
];

const LEGACY_REASONING_MAP: Record<string, ReasoningEffortLevel> = {
  light: "low",
  medium: "medium",
  thorough: "xhigh",
  low: "low",
  high: "high",
  max: "xhigh",
  xhigh: "xhigh",
};

function isReasoningEffortLevel(
  value: string | null | undefined,
): value is ReasoningEffortLevel {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
  );
}

function normalizeLegacyModel(stored: string | null): string {
  if (!stored) {
    return DEFAULT_MODEL_SETTING;
  }

  const normalized = stored.trim();
  if (!normalized) {
    return DEFAULT_MODEL_SETTING;
  }

  if (
    normalized === "sonnet" ||
    normalized === "opus" ||
    normalized === "haiku"
  ) {
    return DEFAULT_MODEL_SETTING;
  }

  return normalized;
}

function loadModel(): string {
  return normalizeLegacyModel(getServerScoped("model", LEGACY_KEYS.model));
}

function saveModel(model: string) {
  setServerScoped(
    "model",
    model.trim() || DEFAULT_MODEL_SETTING,
    LEGACY_KEYS.model,
  );
}

function loadReasoningEffort(): ReasoningEffortLevel {
  const stored = getServerScoped(
    "reasoningEffort",
    LEGACY_KEYS.reasoningEffort,
  );
  if (isReasoningEffortLevel(stored)) {
    return stored;
  }

  const legacyLevel = getServerScoped("thinkingLevel", LEGACY_KEYS.thinkingLevel);
  if (legacyLevel) {
    const migratedLevel = LEGACY_REASONING_MAP[legacyLevel];
    if (migratedLevel) {
      saveReasoningEffort(migratedLevel);
      return migratedLevel;
    }
  }

  const legacyMode = getServerScoped("thinkingMode", LEGACY_KEYS.thinkingMode);
  const legacyEnabled = getServerScoped(
    "thinkingEnabled",
    LEGACY_KEYS.thinkingEnabled,
  );
  if (legacyMode || legacyEnabled) {
    saveReasoningEffort(DEFAULT_REASONING_EFFORT);
    return DEFAULT_REASONING_EFFORT;
  }

  return DEFAULT_REASONING_EFFORT;
}

function saveReasoningEffort(level: ReasoningEffortLevel) {
  setServerScoped(
    "reasoningEffort",
    level,
    LEGACY_KEYS.reasoningEffort,
  );
}

function loadFastMode(): boolean {
  const stored = getServerScoped("fastMode", LEGACY_KEYS.fastMode);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return false;
}

function saveFastMode(enabled: boolean) {
  setServerScoped("fastMode", enabled ? "true" : "false", LEGACY_KEYS.fastMode);
}

function loadVoiceInputEnabled(): boolean {
  const stored = getServerScoped(
    "voiceInputEnabled",
    LEGACY_KEYS.voiceInputEnabled,
  );
  return stored !== "false";
}

function saveVoiceInputEnabled(enabled: boolean) {
  setServerScoped(
    "voiceInputEnabled",
    enabled ? "true" : "false",
    LEGACY_KEYS.voiceInputEnabled,
  );
}

/**
 * Hook to manage model, reasoning, and fast-mode preferences.
 */
export function useModelSettings() {
  const [model, setModelState] = useState<string>(loadModel);
  const [reasoningEffort, setReasoningEffortState] = useState<ReasoningEffortLevel>(
    loadReasoningEffort,
  );
  const [fastMode, setFastModeState] = useState<boolean>(loadFastMode);
  const [voiceInputEnabled, setVoiceInputEnabledState] = useState<boolean>(
    loadVoiceInputEnabled,
  );

  const setModel = useCallback((m: string) => {
    const normalized = normalizeLegacyModel(m);
    setModelState(normalized);
    saveModel(normalized);
  }, []);

  const setReasoningEffort = useCallback((level: ReasoningEffortLevel) => {
    setReasoningEffortState(level);
    saveReasoningEffort(level);
  }, []);

  const setFastMode = useCallback((enabled: boolean) => {
    setFastModeState(enabled);
    saveFastMode(enabled);
  }, []);

  const toggleFastMode = useCallback(() => {
    const next = !fastMode;
    setFastModeState(next);
    saveFastMode(next);
  }, [fastMode]);

  const setVoiceInputEnabled = useCallback((enabled: boolean) => {
    setVoiceInputEnabledState(enabled);
    saveVoiceInputEnabled(enabled);
  }, []);

  const toggleVoiceInput = useCallback(() => {
    const newEnabled = !voiceInputEnabled;
    setVoiceInputEnabledState(newEnabled);
    saveVoiceInputEnabled(newEnabled);
  }, [voiceInputEnabled]);

  return {
    model,
    setModel,
    reasoningEffort,
    setReasoningEffort,
    effortLevel: reasoningEffort,
    setEffortLevel: setReasoningEffort,
    fastMode,
    setFastMode,
    toggleFastMode,
    voiceInputEnabled,
    setVoiceInputEnabled,
    toggleVoiceInput,
  };
}

export function getModelSetting(): string {
  return loadModel();
}

export function getReasoningEffortSetting(): ReasoningEffortLevel {
  return loadReasoningEffort();
}

export function getFastModeSetting(): boolean {
  return loadFastMode();
}

/**
 * Legacy compatibility helper for old code paths.
 * New code should use getReasoningEffortSetting instead.
 */
export function getThinkingSetting(): ThinkingOption {
  const effort = loadReasoningEffort();
  const legacyEffort = effort === "xhigh" ? "max" : effort;
  return `on:${legacyEffort}` as ThinkingOption;
}

/**
 * Legacy compatibility helper for old code paths.
 * New composer UI no longer supports off/auto modes.
 */
export function getThinkingMode(): ThinkingMode {
  return "on";
}

export function getVoiceInputEnabled(): boolean {
  return loadVoiceInputEnabled();
}
