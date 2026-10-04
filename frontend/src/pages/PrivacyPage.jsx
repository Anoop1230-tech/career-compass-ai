import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

// Section ids, in order. Each has "privacy.<id>.title" and "privacy.<id>.body" in en.js / hi.js;
// a body with several lines is shown as a bullet list.
const SECTIONS = ["collect", "resume", "use", "cookies", "where", "security", "choices", "children", "changes"];

export const PRIVACY_CONTACT = "kumaranoop849250@gmail.com";

export default function PrivacyPage() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = `${t("privacy.title")} - Career Compass AI`;
    return () => {
      document.title = "Career Compass AI";
    };
  }, [t]);

  return (
    <section className="container legal">
      <h1>{t("privacy.title")}</h1>
      <p className="muted">{t("privacy.updated")}</p>
      <p>{t("privacy.intro")}</p>

      {SECTIONS.map((id) => {
        const lines = t(`privacy.${id}.body`).split("\n");
        return (
          <section key={id} aria-labelledby={`privacy-${id}`}>
            <h2 id={`privacy-${id}`}>{t(`privacy.${id}.title`)}</h2>
            {lines.length > 1 ? (
              <ul>
                {lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : (
              <p>{lines[0]}</p>
            )}
          </section>
        );
      })}

      <p>
        {t("privacy.contact")} <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
      </p>
      <p>
        <Link to="/">{t("notFound.home")}</Link>
      </p>
    </section>
  );
}
