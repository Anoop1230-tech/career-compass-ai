import { THEMES, useTheme } from "../theme";
import Icon from "./Icon";

/**
 * Theme picker: a labelled group of radio buttons (arrow keys move between them),
 * drawn as a compact segmented control with an icon and a tooltip for each option.
 */
export default function ThemePicker() {
  const [choice, choose] = useTheme();
  const current = THEMES.find((t) => t.value === choice);

  return (
    <fieldset className="theme-picker">
      <legend className="theme-picker__legend">
        Theme <span className="theme-picker__current">{current.label}</span>
      </legend>
      <div className="theme-picker__options">
        {THEMES.map((t) => (
          <label key={t.value} className="theme-picker__option" title={t.label}>
            <input type="radio" name="theme" value={t.value} checked={choice === t.value}
              onChange={() => choose(t.value)} aria-label={t.label} />
            <span aria-hidden="true"><Icon name={t.icon} size={17} /></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
