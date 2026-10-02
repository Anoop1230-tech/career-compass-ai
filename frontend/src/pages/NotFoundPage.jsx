import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="page-center">
      <div className="page-center__box">
        <span className="badge">404</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>{t("notFound.title")}</h1>
        <p className="muted">{t("notFound.text")}</p>
        <div className="btn-row">
          <Link to="/" className="btn btn--primary">
            {t("notFound.home")}
          </Link>
        </div>
      </div>
    </section>
  );
}
