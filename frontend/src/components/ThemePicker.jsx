import { useI18n } from "../i18n";
import { THEMES, useTheme } from "../theme";
import Icon from "./Icon";

/**
 * Theme picker: a labelled group of radio buttons (arrow keys move between them),
 * drawn as a compact segmented control with an icon and a tooltip for each option.
 */
export default function ThemePicker() {
  const [choice, choose] = useTheme();
  const { t } = useI18n();
  const label = (theme) => t(`theme.${theme.value}`);
  const current = THEMES.find((theme) => theme.value === choice);

  return (
    <fieldset className="theme-picker">
      <legend className="theme-picker__legend">
        {t("theme.label")} <span className="theme-picker__current">{label(current)}</span>
      </legend>
      <div className="theme-picker__options">
        {THEMES.map((theme) => (
          <label key={theme.value} className="theme-picker__option" title={label(theme)}>
            <input type="radio" name="theme" value={theme.value} checked={choice === theme.value}
              onChange={() => choose(theme.value)} aria-label={label(theme)} />
            <span aria-hidden="true"><Icon name={theme.icon} size={17} /></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
