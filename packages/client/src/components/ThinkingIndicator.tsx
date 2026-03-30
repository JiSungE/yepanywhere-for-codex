/**
 * Unified thinking/running indicator component.
 * Use this for all "thinking", "running", or "processing" state indicators.
 *
 * Variants:
 * - "dot": Compact pulsing dot only (8x8px)
 * - "pill": Pill badge with pulsing dot and text label
 *
 * Examples:
 *   <ThinkingIndicator />                    // Just a pulsing dot
 *   <ThinkingIndicator variant="pill" />     // Pill with "Thinking" text
 *   <ThinkingIndicator variant="pill" label="Running" />
 */

import { useOptionalI18n } from "../i18n";

interface ThinkingIndicatorProps {
  /** Visual variant - "dot" for compact, "pill" for badge with text */
  variant?: "dot" | "pill";
  /** Text label for pill variant (default: "Thinking") */
  label?: string;
  /** Optional className for additional styling */
  className?: string;
}

export function ThinkingIndicator({
  variant = "dot",
  label,
  className,
}: ThinkingIndicatorProps) {
  const { t } = useOptionalI18n();
  const resolvedLabel = label ?? t("thinkingLabel");
  const dot = <span className="thinking-indicator-dot" />;

  if (variant === "pill") {
    return (
      <span className={`thinking-indicator-pill ${className ?? ""}`}>
        {dot}
        <span className="thinking-indicator-label">{resolvedLabel}</span>
      </span>
    );
  }

  return <span className={`thinking-indicator ${className ?? ""}`}>{dot}</span>;
}
