import { useMemo } from "react";
import { useProviders } from "../../hooks/useProviders";
import { useI18n } from "../../i18n";
import { getAllProviders } from "../../providers/registry";

export function CodexSettings() {
  const { t } = useI18n();
  const { providers: serverProviders } = useProviders();

  const runtimes = useMemo(() => {
    const registered = getAllProviders();
    return registered.map((runtime) => {
      const serverInfo = serverProviders.find((p) => p.name === runtime.id);
      return {
        ...runtime,
        installed: serverInfo?.installed ?? false,
        authenticated: serverInfo?.authenticated ?? false,
      };
    });
  }, [serverProviders]);

  return (
    <section className="settings-section">
      <h2>Codex runtimes</h2>
      <p className="settings-section-description">
        This build only supports Codex. `codex-oss` stays available as an
        alternate runtime when installed.
      </p>
      <div className="settings-group">
        {runtimes.map((runtime) => (
          <div key={runtime.id} className="settings-item">
            <div className="settings-item-info">
              <div className="settings-item-header">
                <strong>{runtime.displayName}</strong>
                {runtime.installed ? (
                  <span className="settings-status-badge settings-status-detected">
                    {t("providersDetected")}
                  </span>
                ) : (
                  <span className="settings-status-badge settings-status-not-detected">
                    {t("providersNotDetected")}
                  </span>
                )}
              </div>
              <p>{runtime.metadata.description}</p>
              {runtime.metadata.limitations.length > 0 && (
                <ul className="settings-limitations">
                  {runtime.metadata.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              )}
            </div>
            {runtime.metadata.website && (
              <a
                href={runtime.metadata.website}
                target="_blank"
                rel="noopener noreferrer"
                className="settings-link"
              >
                {t("providersWebsite")}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
