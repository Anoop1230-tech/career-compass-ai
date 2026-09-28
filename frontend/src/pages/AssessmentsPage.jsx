import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../services/api";

export default function AssessmentsPage() {
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

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>Assessments</h1>
            <p className="muted">
              Three short tests that make your recommendations more personal. Take them in any order.
            </p>
          </div>
        </div>

        {state.status === "loading" && (
          <div className="page-center" style={{ minHeight: 200 }} role="status" aria-label="Loading tests">
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
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <div className="grid">
            {state.items.map((t) => (
              <article key={t.kind} className="card assessment-card">
                <span className="badge">
                  {t.completed_at ? "Completed" : t.in_progress ? "In progress" : `${t.question_count} questions`}
                </span>
                <h2 className="career-card__title">{t.title}</h2>
                <p className="muted">{t.description}</p>
                <p className="small muted">About {t.minutes} minutes</p>
                <div className="btn-row">
                  <Link to={`/assessments/${t.kind}`} className="btn btn--primary btn--small">
                    {t.in_progress ? "Continue" : t.completed_at ? "Retake" : "Start"}
                  </Link>
                  {t.completed_at && (
                    <Link to={`/assessments/${t.kind}/result`} className="btn btn--secondary btn--small">
                      View result
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
          These tests describe your preferences and a short quiz result. They are for self-reflection and career
          guidance only, not a clinical or professional psychological assessment.
        </p>
      </div>
    </section>
  );
}
