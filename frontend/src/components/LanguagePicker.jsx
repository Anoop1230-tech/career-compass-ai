import { LANGUAGES } from "../i18n/core";
import { useI18n } from "../i18n";

/**
 * Language picker: two radio buttons (arrow keys work), styled like the theme picker.
 * Each option is labelled in its own language, so people can find theirs.
 */
export default function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  return (
    <fieldset className="theme-picker">
      <legend className="theme-picker__legend">{t("lang.label")}</legend>
      <div className="theme-picker__options">
        {LANGUAGES.map((l) => (
          <label key={l.value} className="theme-picker__option theme-picker__option--text" title={l.label} lang={l.value}>
            <input type="radio" name="language" value={l.value} checked={lang === l.value}
              onChange={() => setLang(l.value)} aria-label={l.label} />
            <span aria-hidden="true">{l.short}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
