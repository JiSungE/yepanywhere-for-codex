import {
  DEFAULT_MODEL_SETTING,
  REASONING_EFFORT_OPTIONS,
  useModelSettings,
} from "../../hooks/useModelSettings";
import { getDefaultProvider, useProviders } from "../../hooks/useProviders";
import { useI18n } from "../../i18n";

export function ModelSettings() {
  const { t } = useI18n();
  const { providers } = useProviders();
  const defaultProvider = getDefaultProvider(providers);
  const availableModels = defaultProvider?.models ?? [];
  const {
    model,
    setModel,
    reasoningEffort,
    setReasoningEffort,
    fastMode,
    setFastMode,
  } = useModelSettings();

  return (
    <section className="settings-section">
      <h2>{t("modelSettingsTitle")}</h2>
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-info">
            <strong>{t("modelSettingsModelTitle")}</strong>
            <p>{t("modelSettingsModelDescription")}</p>
          </div>
          <div className="font-size-selector">
            <button
              type="button"
              className={`font-size-option ${model === DEFAULT_MODEL_SETTING ? "active" : ""}`}
              onClick={() => setModel(DEFAULT_MODEL_SETTING)}
            >
              {t("modelSettingsModelDefault")}
            </button>
            {availableModels.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`font-size-option ${model === opt.id ? "active" : ""}`}
                onClick={() => setModel(opt.id)}
                title={opt.description}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-item">
          <div className="settings-item-info">
            <strong>{t("modelSettingsReasoningTitle")}</strong>
            <p>{t("modelSettingsReasoningDescription")}</p>
          </div>
          <div className="font-size-selector">
            {REASONING_EFFORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`font-size-option ${reasoningEffort === opt.value ? "active" : ""}`}
                onClick={() => setReasoningEffort(opt.value)}
                title={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-item">
          <div className="settings-item-info">
            <strong>{t("modelSettingsFastModeTitle")}</strong>
            <p>{t("modelSettingsFastModeDescription")}</p>
          </div>
          <div className="font-size-selector">
            <button
              type="button"
              className={`font-size-option ${!fastMode ? "active" : ""}`}
              onClick={() => setFastMode(false)}
            >
              {t("modelSettingsFastModeOff")}
            </button>
            <button
              type="button"
              className={`font-size-option ${fastMode ? "active" : ""}`}
              onClick={() => setFastMode(true)}
            >
              {t("modelSettingsFastModeOn")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
