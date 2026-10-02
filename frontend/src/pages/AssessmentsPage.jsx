import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import * as api from "../services/api";

export default function AssessmentsPage() {
  const { t } = useI18n();
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getAssessments()
      .then((items) => active && setState({ status: "ready", items }))
      .catch((err) => active && setState({ status: "error", error: api.getErrorMessage(err) }));
    return () => {
      active = false;
    };
  }, [attempt]);

  // Test names and descriptions are translated by kind; the server's English text is the fallback
  const text = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("nav.assessments")}</h1>
            <p className="muted">{t("assess.lead")}</p>
          </div>
        </div>

        {state.status === "loading" && (
          <div className="page-center" style={{ minHeight: 200 }} role="status" aria-label={t("assess.loadingTests")}>
            <div className="loader" />
          </div>
        )}

        {state.status === "error" && (
          <div className="notice notice--danger" role="alert">
            <p>{state.error}</p>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}>
              {t("common.tryAgain")}
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <div className="grid">
            {state.items.map((x) => (
              <article key={x.kind} className="card assessment-card">
                <span className="badge">
                  {x.completed_at ? t("assess.completed") : x.in_progress ? t("assess.inProgress")
                    : t("assess.questions", { n: x.question_count })}
                </span>
                <h2 className="career-card__title">{text(`assess.kind.${x.kind}`, x.title)}</h2>
                <p className="muted">{text(`assess.kind.${x.kind}.description`, x.description)}</p>
                <p className="small muted">{t("assess.minutes", { n: x.minutes })}</p>
                <div className="btn-row">
                  <Link to={`/assessments/${x.kind}`} className="btn btn--primary btn--small">
                    {x.in_progress ? t("profile.continue") : x.completed_at ? t("assess.retake") : t("assess.start")}
                  </Link>
                  {x.completed_at && (
                    <Link to={`/assessments/${x.kind}/result`} className="btn btn--secondary btn--small">
                      {t("assess.viewResult")}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-6)" }}>{t("assess.disclaimer")}</p>
      </div>
    </section>
  );
}
