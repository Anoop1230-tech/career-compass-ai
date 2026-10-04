import { Link } from "react-router-dom";
import { useHealth } from "../hooks/useHealth";
import { useI18n } from "../i18n";

export default function Footer() {
  const { status, error, retry } = useHealth();
  const { t } = useI18n();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>
          {t("footer.tagline", { year: new Date().getFullYear() })} ·{" "}
          <Link to="/privacy">{t("footer.privacy")}</Link>
        </span>

        <span className={`status status--${status}`} role="status" aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          <span title={error || undefined}>{t(`footer.${status}`)}</span>
          {status === "offline" && (
            <button type="button" className="btn btn--secondary btn--small" onClick={retry}>
              {t("footer.retry")}
            </button>
          )}
        </span>
      </div>
    </footer>
  );
}
