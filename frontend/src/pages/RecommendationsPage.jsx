import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter } from "../components/Status";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

const LEVEL_TEXT = {
  high: "High – based on your tests, skills and profile.",
  medium: "Medium – some signals are missing.",
  low: "Low – take the tests and add skills for better results.",
};

export function FitBreakdown({ item }) {
  return (
    <ul className="score-list fit-breakdown">
      {item.components.map((c) => (
        <li key={c.key}>
          <div className="score-list__head small">
            <span>{c.label} <span className="muted">· weight {c.weight}%</span></span>
            <span className="muted">{c.available ? `${Math.round(c.score)}/100` : "not available"}</span>
          </div>
          {c.available ? <Meter value={c.score} label={`${c.label} for ${item.name}`} /> : <div className="meter" aria-hidden="true" />}
          {c.explanation && <p className="muted small">{c.explanation}</p>}
        </li>
      ))}
    </ul>
  );
}

const REASONS = [
  { value: "not_interested", label: "Not interested in this work" },
  { value: "too_hard_to_reach", label: "Too hard to reach from where I am" },
  { value: "skills_mismatch", label: "Doesn't match my skills" },
  { value: "pay_or_lifestyle", label: "Pay or lifestyle doesn't suit me" },
  { value: "other", label: "Something else" },
];

/** "Does this fit you?" – saved per career; used to check the engine against real answers. */
function Feedback({ item }) {
  const [value, setValue] = useState(item.feedback);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = `fb-${item.career_id}`;

  const save = async (verdict, reason) => {
    const previous = value;
    setValue({ verdict, reason: reason || null }); // show at once; roll back on error
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveRecommendationFeedback(item.career_id, verdict, reason);
      setValue(saved.feedback);
    } catch (err) {
      setValue(previous);
      setError(api.getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    const previous = value;
    setValue(null);
    setError("");
    try {
      await api.deleteRecommendationFeedback(item.career_id);
    } catch (err) {
      setValue(previous);
      setError(api.getErrorMessage(err));
    }
  };

  return (
    <fieldset className="rec-feedback small" disabled={busy}>
      <legend>Does {item.name} fit you?</legend>
      <div className="btn-row">
        <button type="button" className={`btn btn--small ${value?.verdict === "fits" ? "btn--primary" : "btn--secondary"}`}
          aria-pressed={value?.verdict === "fits"} onClick={() => save("fits")}>Yes, it fits</button>
        <button type="button" className={`btn btn--small ${value?.verdict === "not_for_me" ? "btn--primary" : "btn--secondary"}`}
          aria-pressed={value?.verdict === "not_for_me"} onClick={() => save("not_for_me", value?.reason)}>Not for me</button>
        {value && <button type="button" className="link-button small" onClick={clear}>Remove answer</button>}
      </div>
      {value?.verdict === "not_for_me" && (
        <div className="field" style={{ margin: "var(--space-3) 0 0" }}>
          <label className="field__label" htmlFor={`${name}-reason`}>Main reason <span className="field__optional">(optional)</span></label>
          <select id={`${name}-reason`} className="input" value={value.reason || ""}
            onChange={(e) => save("not_for_me", e.target.value || undefined)}>
            <option value="">Choose a reason</option>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}
      {value && !error && <p className="muted small" role="status" style={{ margin: "var(--space-2) 0 0" }}>Thanks, your answer is saved.</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </fieldset>
  );
}

function RecommendationCard({ item, rank }) {
  const [open, setOpen] = useState(false);
  const id = `rec-${item.career_id}`;
  return (
    <article className="card rec-card" aria-labelledby={id}>
      <div className="rec-card__head">
        <span className="rec-card__rank" aria-hidden="true">{rank}</span>
        <div className="rec-card__title">
          <h2 id={id}><Link to={`/careers/${item.career_id}`}>{item.name}</Link></h2>
          <p className="muted small">{item.domain}{item.sub_domain ? ` · ${item.sub_domain}` : ""}</p>
        </div>
        <div className="rec-card__score" aria-label={`Match ${Math.round(item.score)} out of 100`}>
          <strong>{Math.round(item.score)}</strong><span className="muted small">/100</span>
        </div>
      </div>
      <p className="small">{item.description}</p>

      {item.strengths.length > 0 && (
        <div className="small">
          <strong>Why it fits</strong>
          <ul className="plain-list">{item.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {item.concerns.length > 0 && (
        <div className="small">
          <strong>Keep in mind</strong>
          <ul className="plain-list">{item.concerns.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {item.skills_to_learn.length > 0 && (
        <p className="small muted" style={{ margin: 0 }}>Core skills to learn: {item.skills_to_learn.join(", ")}</p>
      )}

      <div className="btn-row">
        <Link to={`/skill-gap?career=${item.career_id}`} className="btn btn--secondary btn--small">Skill gap</Link>
        <Link to={`/roadmap?career=${item.career_id}`} className="btn btn--secondary btn--small">Roadmap</Link>
        <button type="button" className="link-button small" aria-expanded={open} aria-controls={`${id}-why`}
          onClick={() => setOpen((v) => !v)}>
          {open ? "Hide score details" : "How this score was made"}
        </button>
      </div>
      {open && <div id={`${id}-why`}><FitBreakdown item={item} /></div>}
      <Feedback item={item} />
    </article>
  );
}

export default function RecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const domain = params.get("domain") || "";
  const rec = useRequest((signal) => api.getRecommendations({ domain, limit: 15 }, signal), [domain]);

  if (rec.status === "error" && api.isNotFound(rec.raw)) {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>Create your profile first</h1>
          <p className="muted">Recommendations use your education, skills, interests and goals.</p>
          <Link to="/profile/edit" className="btn btn--primary">Create profile</Link>
        </div>
      </section>
    );
  }

  const data = rec.data;
  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>Careers for you</h1>
            <p className="muted">Ranked by how well each career matches your profile, skills and test results.</p>
          </div>
          {data && (
            <div className="field" style={{ margin: 0, minWidth: 200 }}>
              <label className="field__label" htmlFor="rec-domain">Area</label>
              <select id="rec-domain" className="input" value={domain}
                onChange={(e) => setParams(e.target.value ? { domain: e.target.value } : {})}>
                <option value="">All areas</option>
                {data.domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>

        {rec.status === "loading" && <Loading label="Loading recommendations" />}
        {rec.status === "error" && <ErrorNotice message={rec.error} onRetry={rec.reload} />}

        {rec.status === "ready" && (
          <>
            <div className="notice confidence">
              <p style={{ margin: 0 }}>
                <strong>Confidence: {data.confidence.percent}%</strong> · {LEVEL_TEXT[data.confidence.level]}
                {data.stage?.name && <> Starting point: {data.stage.name}.</>}
              </p>
              {data.confidence.improve.length > 0 && (
                <ul className="tag-list" style={{ marginTop: "var(--space-3)" }}>
                  {data.confidence.improve.map((t) => (
                    <li key={t.key}><Link to={t.link} className="btn btn--secondary btn--small">{t.text}</Link></li>
                  ))}
                </ul>
              )}
              {data.unmatched_skills.length > 0 && (
                <p className="small muted" style={{ margin: "var(--space-3) 0 0" }}>
                  Not recognised (not counted): {data.unmatched_skills.join(", ")}
                </p>
              )}
            </div>

            {data.items.length === 0 ? (
              <p className="notice" style={{ marginTop: "var(--space-5)" }}>
                We need a little more about you. Add your education and skills, or take a test.
              </p>
            ) : (
              <div className="rec-list">
                {data.items.map((item, i) => <RecommendationCard key={item.career_id} item={item} rank={i + 1} />)}
              </div>
            )}

            <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
              Scores combine six signals with fixed weights (interest {data.weights.interest}%, skills{" "}
              {data.weights.skills}%, education {data.weights.education}%, aptitude {data.weights.aptitude}%, work
              style {data.weights.personality}%, interests and goals {data.weights.preferences}%). Missing signals are
              left out and the others count more. This is guidance, not a prediction of success. Your "does it fit
              you?" answers are private to your account and are only used to check how well these scores work.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
