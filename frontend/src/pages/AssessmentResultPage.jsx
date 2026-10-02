import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { kindLabel, scaleLabel } from "../assessments/assessmentUtils";
import { useI18n } from "../i18n";
import * as api from "../services/api";

function ScoreBars({ scales }) {
  const { t } = useI18n();
  return (
    <ul className="score-list">
      {scales.map((s) => (
        <li key={s.key}>
          <div className="score-list__head">
            <span>{scaleLabel(t, s.key)}</span>
            <span className="muted small">{t(`assess.band.${s.band}`)} · {Math.round(s.score)}/100</span>
          </div>
          <div className="meter" role="img" aria-label={t("common.outOf100", { label: scaleLabel(t, s.key), n: Math.round(s.score) })}>
            <div className={`meter__bar meter__bar--${s.band}`} style={{ width: `${s.score}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AptitudeReview({ details }) {
  const { t } = useI18n();
  const [onlyWrong, setOnlyWrong] = useState(true);
  const shown = onlyWrong ? details.filter((d) => !d.is_correct) : details;
  return (
    <section className="detail-block">
      <div className="page__head" style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ margin: 0 }}>{t("assess.review")}</h2>
        <label className="checkbox">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          <span>{t("assess.onlyMistakes")}</span>
        </label>
      </div>
      {shown.length === 0 && <p className="notice">{t("assess.noMistakes")}</p>}
      <ol className="review-list">
        {shown.map((d) => {
          const text = (key) => d.options.find((o) => o.key === key)?.text;
          return (
            <li key={d.question_id} className="card">
              <p className="small muted" style={{ margin: 0 }}>{scaleLabel(t, d.category)}</p>
              <p style={{ fontWeight: 600 }}>{d.text}</p>
              <p className="small" style={{ margin: 0 }}>
                {t("assess.yourAnswerLabel")}{" "}
                <span className={d.is_correct ? "text-success" : "text-danger"}>
                  {d.chosen ? text(d.chosen) : t("assess.skipped")} {d.is_correct ? "✓" : "✗"}
                </span>
              </p>
              {!d.is_correct && <p className="small" style={{ margin: 0 }}>{t("assess.correctAnswer")} <strong>{text(d.correct_option)}</strong></p>}
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
  const { t, lang } = useI18n();

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
    return <div className="page-center" role="status" aria-label={t("assess.loadingResult")}><div className="loader" /></div>;
  }
  if (state.status === "none") {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>{t("assess.noResult")}</h1>
          <p className="muted">{t("assess.notTaken")}</p>
          <Link to={`/assessments/${kind}`} className="btn btn--primary">{t("assess.take")}</Link>
        </div>
      </section>
    );
  }
  if (state.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>{t("assess.resultError")}</h1>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}>{t("common.tryAgain")}</button>
        </div>
      </section>
    );
  }

  const { result, created_at: createdAt } = state.data;
  const scales = [...result.scales].sort((a, b) => b.score - a.score);

  return (
    <section className="page">
      <div className="container" style={{ maxWidth: 860 }}>
        <nav aria-label={t("common.breadcrumb")} className="breadcrumb">
          <Link to="/assessments">{t("nav.assessments")}</Link> <span aria-hidden="true">/</span> <span>{t("assess.result")}</span>
        </nav>
        <div className="page__head">
          <div>
            <h1>{kindLabel(t, kind)}</h1>
            <p className="muted">{t("assess.takenOn", { date: new Date(createdAt).toLocaleDateString(lang === "hi" ? "hi-IN" : undefined) })}</p>
          </div>
          <div className="btn-row">
            <Link to={`/assessments/${kind}`} className="btn btn--secondary">{t("assess.retake")}</Link>
            <Link to="/assessments" className="btn btn--primary">{t("assess.allTests")}</Link>
          </div>
        </div>

        {kind === "interest" && (
          <div className="card summary-card">
            <p className="small muted" style={{ margin: 0 }}>{t("assess.topCode")}</p>
            <p className="summary-card__big">{result.top_code}</p>
            <p style={{ margin: 0 }}>{result.top_types.join(", ")}</p>
            {result.undifferentiated && (
              <p className="notice small" style={{ marginTop: "var(--space-4)" }}>{t("assess.undifferentiated")}</p>
            )}
          </div>
        )}

        {kind === "personality" && result.consistency_warning && (
          <p className="notice">{t("assess.consistencyWarning")}</p>
        )}

        {kind === "aptitude" && (
          <div className="card summary-card">
            <p className="small muted" style={{ margin: 0 }}>{t("assess.overall")}</p>
            <p className="summary-card__big">{Math.round(result.overall)}%</p>
            <p style={{ margin: 0 }}>{t("assess.correctCount", { n: result.correct, total: result.total })}</p>
          </div>
        )}

        <section className="card" style={{ marginTop: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>{kind === "aptitude" ? t("assess.byCategory") : t("assess.yourScores")}</h2>
          <ScoreBars scales={scales} />
        </section>

        {kind === "aptitude" && <AptitudeReview details={result.details} />}

        <p className="notice small" style={{ marginTop: "var(--space-5)" }}>{t("assess.resultDisclaimer")}</p>
      </div>
    </section>
  );
}
