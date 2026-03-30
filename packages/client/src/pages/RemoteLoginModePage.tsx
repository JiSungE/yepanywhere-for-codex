/**
 * RemoteLoginModePage - Mode selection for remote client login.
 *
 * Landing page that lets users choose between:
 * - Relay connection (for NAT traversal via public relay server)
 * - Direct connection (for LAN, Tailscale, or direct WS URL)
 */

import { useNavigate } from "react-router-dom";
import { YepAnywhereLogo } from "../components/YepAnywhereLogo";
import { useRemoteConnection } from "../contexts/RemoteConnectionContext";
import { useI18n } from "../i18n";

export function RemoteLoginModePage() {
  const navigate = useNavigate();
  const { isAutoResuming } = useRemoteConnection();
  const { t } = useI18n();

  // If auto-resume is in progress, show a loading screen
  if (isAutoResuming) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-logo">
            <YepAnywhereLogo />
          </div>
          <p className="login-subtitle">{t("remoteLoginReconnect")}</p>
          <div className="login-loading" data-testid="auto-resume-loading">
            <div className="login-spinner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <YepAnywhereLogo />
        </div>
        <p className="login-subtitle">{t("remoteLoginModeSubtitle")}</p>

        <div className="login-mode-options">
          <button
            type="button"
            className="login-mode-option"
            onClick={() => navigate("/relay")}
            data-testid="relay-mode-button"
          >
            <span className="login-mode-option-title">
              {t("remoteLoginRelayTitle")}
            </span>
            <span className="login-mode-option-desc">
              {t("remoteLoginRelayDescription")}
            </span>
          </button>

          <button
            type="button"
            className="login-mode-option login-mode-option-secondary"
            onClick={() => navigate("/direct")}
            data-testid="direct-mode-button"
          >
            <span className="login-mode-option-title">
              {t("remoteLoginDirectTitle")}
            </span>
            <span className="login-mode-option-desc">
              {t("remoteLoginDirectDescription")}
            </span>
          </button>
        </div>

        <p className="login-hint">{t("remoteLoginHint")}</p>
      </div>
    </div>
  );
}
