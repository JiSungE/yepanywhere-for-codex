import type { ProviderName } from "@yep-anywhere/shared";

const PROVIDER_COLORS: Record<ProviderName, string> = {
  codex: "var(--provider-codex)", // OpenAI green
  "codex-oss": "var(--provider-codex)", // OpenAI green (same as codex)
};

const PROVIDER_LABELS: Record<ProviderName, string> = {
  codex: "Codex",
  "codex-oss": "CodexOSS",
};

interface ProviderBadgeProps {
  provider: ProviderName;
  /** Show as small dot only (for sidebar) vs full badge (for header) */
  compact?: boolean;
  /** Model name to display alongside provider (e.g., "opus", "sonnet") */
  model?: string;
  /** Whether the session is actively thinking/processing */
  isThinking?: boolean;
  className?: string;
}

/**
 * Badge showing which AI provider is running a session.
 * Use compact mode for sidebar lists, full mode for session headers.
 */
export function ProviderBadge({
  provider,
  compact = false,
  model,
  isThinking = false,
  className = "",
}: ProviderBadgeProps) {
  const color = PROVIDER_COLORS[provider];
  const label = PROVIDER_LABELS[provider];

  // Format model name for display
  const getModelLabel = (modelName: string | undefined): string | null => {
    if (!modelName) return null;
    if (modelName === "default") return null;

    return modelName
      .split(/[-_:]/)
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase();
        if (lower === "gpt") return "GPT";
        if (lower === "codex") return "Codex";
        if (lower === "oss") return "OSS";
        if (/^\d/.test(part)) return part;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join("-");
  };

  const modelLabel = getModelLabel(model);

  if (compact) {
    return (
      <span
        className={`provider-badge-stripe ${className}`}
        style={{ backgroundColor: color }}
        title={modelLabel ? `${label} (${modelLabel})` : label}
        aria-label={`Provider: ${label}${modelLabel ? ` (${modelLabel})` : ""}`}
      />
    );
  }

  // When thinking, dot is always orange with pulse animation
  const dotClass = isThinking
    ? "provider-badge-dot-inline thinking"
    : "provider-badge-dot-inline";
  const dotStyle = isThinking
    ? { backgroundColor: "var(--thinking-color)" }
    : { backgroundColor: color };

  return (
    <span
      className={`provider-badge ${className}`}
      style={{ borderColor: color, color }}
    >
      <span className={dotClass} style={dotStyle} />
      <span className="provider-badge-label">{label}</span>
      {modelLabel && <span className="provider-badge-model">{modelLabel}</span>}
    </span>
  );
}
