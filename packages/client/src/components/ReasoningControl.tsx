import type { ReasoningEffortLevel } from "@yep-anywhere/shared";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  REASONING_EFFORT_OPTIONS,
  useModelSettings,
} from "../hooks/useModelSettings";
import { useI18n } from "../i18n";

const ALL_REASONING_LEVELS: ReasoningEffortLevel[] = [
  "low",
  "medium",
  "high",
  "xhigh",
];

const REASONING_LEVEL_LABEL_KEYS = {
  low: "reasoningLevelLow",
  medium: "reasoningLevelMedium",
  high: "reasoningLevelHigh",
  xhigh: "reasoningLevelVeryHigh",
} as const;

const REASONING_DESCRIPTIONS: Record<ReasoningEffortLevel, string> =
  REASONING_EFFORT_OPTIONS.reduce(
    (acc, option) => {
      acc[option.value] = option.description;
      return acc;
    },
    {} as Record<ReasoningEffortLevel, string>,
  );

const DESKTOP_BREAKPOINT = 769;

interface ReasoningControlProps {
  disabled?: boolean;
  supportsReasoningControl?: boolean;
  reasoningEfforts?: ReasoningEffortLevel[];
  supportsFastMode?: boolean;
  showSelector?: boolean;
}

export function ReasoningControl({
  disabled = false,
  supportsReasoningControl = true,
  reasoningEfforts = ["low", "medium", "high", "xhigh"],
  supportsFastMode = false,
  showSelector = true,
}: ReasoningControlProps) {
  const { t } = useI18n();
  const { reasoningEffort, setReasoningEffort, fastMode, setFastMode } =
    useModelSettings();
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const supportedLevels = useMemo(
    () => new Set(reasoningEfforts),
    [reasoningEfforts],
  );
  const reasoningEnabled =
    supportsReasoningControl && reasoningEfforts.length > 0;
  const fastEnabled = supportsFastMode;
  const currentReasoningLabel = t(REASONING_LEVEL_LABEL_KEYS[reasoningEffort]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleClose, open]);

  useEffect(() => {
    if (!open || !isDesktop) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        sheetRef.current &&
        !sheetRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose, isDesktop, open]);

  useEffect(() => {
    if (open && !isDesktop) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open, isDesktop]);

  useEffect(() => {
    if (open) {
      sheetRef.current?.focus();
    }
  }, [open]);

  if (!showSelector && !fastEnabled) {
    return null;
  }

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    }
  };

  const optionsContent = (
    <>
      {ALL_REASONING_LEVELS.map((level) => {
        const levelSupported = reasoningEnabled && supportedLevels.has(level);
        const label = t(REASONING_LEVEL_LABEL_KEYS[level]);
        return (
          <button
            key={level}
            type="button"
            className={`mode-selector-option ${reasoningEffort === level ? "selected" : ""}`}
            disabled={!levelSupported}
            onClick={() => {
              setReasoningEffort(level);
              handleClose();
            }}
            aria-pressed={reasoningEffort === level}
            title={
              levelSupported
                ? t("reasoningControlSelect", { level: label })
                : t("reasoningControlLevelUnsupported", { level: label })
            }
          >
            <span className={`mode-dot reasoning-${level}`} />
            <span className="mode-selector-content">
              <span className="mode-selector-label">{label}</span>
              <span className="mode-selector-description">
                {REASONING_DESCRIPTIONS[level]}
              </span>
            </span>
            {reasoningEffort === level && (
              <span className="mode-selector-check" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </>
  );

  const mobileSheet =
    open && !isDesktop
      ? createPortal(
          <div
            className="mode-selector-overlay"
            onClick={handleOverlayClick}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div
              ref={sheetRef}
              className="mode-selector-sheet"
              tabIndex={-1}
              aria-label={t("reasoningControlMenuLabel")}
            >
              <div className="mode-selector-header">
                <span className="mode-selector-title">
                  {t("reasoningControlMenuLabel")}
                </span>
              </div>
              <div className="mode-selector-options">{optionsContent}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const desktopDropdown =
    open && isDesktop ? (
      <div
        ref={sheetRef}
        className="mode-selector-dropdown"
        tabIndex={-1}
        aria-label={t("reasoningControlMenuLabel")}
      >
        <div className="mode-selector-options">{optionsContent}</div>
      </div>
    ) : null;

  return (
    <div className="reasoning-control">
      {showSelector && (
        <div className="mode-selector-container">
          <button
            ref={buttonRef}
            type="button"
            className={`reasoning-trigger ${open ? "open" : ""}`}
            onClick={() => {
              if (!disabled) {
                buttonRef.current?.blur();
                setOpen(true);
              }
            }}
            disabled={disabled || !reasoningEnabled}
            title={
              reasoningEnabled
                ? t("reasoningControlTitle", { level: currentReasoningLabel })
                : t("reasoningControlUnsupported")
            }
            aria-label={t("reasoningControlTitle", {
              level: currentReasoningLabel,
            })}
            aria-expanded={open}
          >
            <span className="reasoning-trigger-label">
              {t("reasoningControlShort", { level: currentReasoningLabel })}
            </span>
            <span className="reasoning-trigger-caret">▾</span>
          </button>
          {desktopDropdown}
          {mobileSheet}
        </div>
      )}
      <button
        type="button"
        className={`fast-mode-button ${fastMode ? "active" : ""}`}
        disabled={disabled || !fastEnabled}
        onClick={() => setFastMode(!fastMode)}
        title={
          fastEnabled
            ? fastMode
              ? t("fastModeEnabled")
              : t("fastModeDisabled")
            : t("fastModeUnsupported")
        }
        aria-pressed={fastMode}
      >
        {t("fastModeLabel")}
      </button>
    </div>
  );
}
