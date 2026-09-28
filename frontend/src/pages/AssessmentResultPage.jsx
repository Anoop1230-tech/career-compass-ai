import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { KIND_LABELS, scaleLabel } from "../assessments/assessmentUtils";
import * as api from "../services/api";

const BAND_TEXT = { low: "Low", moderate: "Moderate", high: "High" };

function ScoreBars({ scales }) {
  return (
    <ul className="score-list">
      {scales.map((s) => (
        <li key={s.key}>
          <div className="score-list__head">
            <span>{scaleLabel(s.key)}</span>
            <span className="muted small">{BAND_TEXT[s.band]} · {Math.round(s.score)}/100</span>
          </div>
          <div className="meter" role="img" aria-label={`${scaleLabel(s.key)}: ${Math.round(s.score)} out of 100`}>
            <div className={`meter__bar meter__bar--${s.band}`} style={{ width: `${s.score}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AptitudeReview({ details }) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const shown = onlyWrong ? details.filter((d) => !d.is_correct) : details;
  return (
    <section className="detail-block">
      <div className="page__head" style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ margin: 0 }}>Review answers</h2>
        <label className="checkbox">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          <span>Show only mistakes and skipped</span>
        </label>
      </div>
      {shown.length === 0 && <p className="notice">No mistakes. Well done!</p>}
      <ol className="review-list">
        {shown.map((d) => {
          const text = (key) => d.options.find((o) => o.key === key)?.text;
          return (
            <li key={d.question_id} className="card">
              <p className="small muted" style={{ margin: 0 }}>{scaleLabel(d.category)}</p>
              <p style={{ fontWeight: 600 }}>{d.text}</p>
              <p className="small" style={{ margin: 0 }}>
                Your answer:{" "}
                <span className={d.is_correct ? "text-success" : "text-danger"}>
                  {d.chosen ? text(d.chosen) : "Skipped"} {d.is_correct ? "✓" : "✗"}
                </span>
              </p>
              {!d.is_correct && <p className="small" style={{ margin: 0 }}>Correct answer: <strong>{text(d.correct_option)}</strong></p>}
              {d.explanation && <p className="small muted" style={{ margin: "var(--space-2) 0 0" }}>{d.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function AssessmentResultPage() {
  const { kind } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getAssessmentResult(kind)
      .then((data) => active && setState({ status: "ready", data }))
      .catch((err) => active && setState({ status: api.isNotFound(err) ? "none" : "error", error: api.getErrorMessage(err) }));
    return () => {
      active = false;
    };
  }, [kind, attempt]);

  if (state.status === "loading") {
    return <div className="page-center" role="status" aria-label="Loading result"><div className="loader" /></div>;
  }
  if (state.status === "none") {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>No result yet</h1>
          <p className="muted">You haven't taken this test yet.</p>
          <Link to={`/assessments/${kind}`} className="btn btn--primary">Take the test</Link>
        </div>
      </section>
    );
  }
  if (state.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>Could not load the result</h1>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}>Try again</button>
        </div>
      </section>
    );
  }

  const { result, created_at: createdAt } = state.data;
  const scales = [...result.scales].sort((a, b) => b.score - a.score);

  return (
    <section className="page">
      <div className="container" style={{ maxWidth: 860 }}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/assessments">Assessments</Link> <span aria-hidden="true">/</span> <span>Result</span>
        </nav>
        <div className="page__head">
          <div>
            <h1>{KIND_LABELS[kind] || "Result"}</h1>
            <p className="muted">Taken on {new Date(createdAt).toLocaleDateString()}</p>
          </div>
          <div className="btn-row">
            <Link to={`/assessments/${kind}`} className="btn btn--secondary">Retake</Link>
            <Link to="/assessments" className="btn btn--primary">All tests</Link>
          </div>
        </div>

        {kind === "interest" && (
          <div className="card summary-card">
            <p className="small muted" style={{ margin: 0 }}>Your top interest code</p>
            <p className="summary-card__big">{result.top_code}</p>
            <p style={{ margin: 0 }}>{result.top_types.join(", ")}</p>
            {result.undifferentiated && (
              <p className="notice small" style={{ marginTop: "var(--space-4)" }}>
                Your answers were very similar across all areas, so no clear preference stands out. Retaking the test
                and using the full range of answers can give a clearer picture.
              </p>
            )}
          </div>
        )}

        {kind === "personality" && result.consistency_warning && (
          <p className="notice">
            You agreed (or disagreed) with almost every statement, including opposite ones. The scores may not reflect
            you well; consider retaking and answering each statement on its own.
          </p>
        )}

        {kind === "aptitude" && (
          <div className="card summary-card">
            <p className="small muted" style={{ margin: 0 }}>Overall score</p>
            <p className="summary-card__big">{Math.round(result.overall)}%</p>
            <p style={{ margin: 0 }}>{result.correct} of {result.total} correct</p>
          </div>
        )}

        <section className="card" style={{ marginTop: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>{kind === "aptitude" ? "By category" : "Your scores"}</h2>
          <ScoreBars scales={scales} />
        </section>

        {kind === "aptitude" && <AptitudeReview details={result.details} />}

        <p className="notice small" style={{ marginTop: "var(--space-5)" }}>
          These results are for self-reflection and career guidance, not a clinical or professional assessment. Your
          career recommendations will use them together with your profile.
        </p>
      </div>
    </section>
  );
}
