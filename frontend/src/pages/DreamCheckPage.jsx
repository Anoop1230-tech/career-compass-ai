import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

const VERDICTS = {
  direct: { title: "Yes – this is a direct route", tone: "ok" },
  achievable: { title: "Yes – with a clear plan", tone: "ok" },
  hard: { title: "Possible, but hard", tone: "warn" },
  not_direct: { title: "Not directly from here", tone: "danger" },
};

function months(t) {
  if (t.months_min == null) return null;
  const fmt = (m) => (m >= 24 && m % 12 === 0 ? `${m / 12} years` : `${m} months`);
  return t.months_min === t.months_max ? fmt(t.months_min) : `${fmt(t.months_min)} – ${fmt(t.months_max)}`;
}

function Route({ steps }) {
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={`${s.id}-${i}`}>
          <strong>{s.type === "career" ? <Link to={`/careers/${s.id}`}>{s.title}</Link> : s.title}</strong>
          {s.years != null && <span className="muted small"> · {s.years} years</span>}
          {s.years_experience && <span className="muted small"> · usually after {s.years_experience} years</span>}
          {s.eligibility && <p className="small">{s.eligibility}</p>}
          {s.exams?.length > 0 && (
            <p className="small">
              Exams: {s.exams.map((e, j) => (
                <span key={e.exam_id}>{j > 0 && ", "}<OfficialLink href={e.official_url}>{e.name}</OfficialLink></span>
              ))}
            </p>
          )}
          {s.notes && <p className="small muted">{s.notes}</p>}
        </li>
      ))}
    </ol>
  );
}

function Form({ initial, onSubmit }) {
  const stages = useRequest(() => api.getStages(), []);
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  const [fromType, setFromType] = useState(initial.from_career ? "career" : "stage");
  const [from, setFrom] = useState(initial.from_career || initial.from_stage || "");
  const [to, setTo] = useState(initial.to || "");
  if (stages.status === "error" || careers.status === "error") {
    return <ErrorNotice message={stages.error || careers.error} onRetry={() => { stages.reload(); careers.reload(); }} />;
  }
  if (stages.status !== "ready" || careers.status !== "ready") return <Loading label="Loading choices" minHeight={120} />;
  const list = careers.data.items;
  return (
    <form className="toolbar dream-form" onSubmit={(e) => {
      e.preventDefault();
      if (to) onSubmit({ to, ...(from ? { [fromType === "career" ? "from_career" : "from_stage"]: from } : {}) });
    }}>
      <fieldset className="field" style={{ margin: 0 }}>
        <legend className="field__label">I am</legend>
        <div className="btn-row" style={{ marginBottom: "var(--space-2)" }}>
          {[["stage", "Studying / studied"], ["career", "Working as"]].map(([value, label]) => (
            <label key={value} className="radio-inline small">
              <input type="radio" name="from-type" value={value} checked={fromType === value}
                onChange={() => { setFromType(value); setFrom(""); }} /> {label}
            </label>
          ))}
        </div>
        <select aria-label={fromType === "career" ? "Current career" : "Current stage"} className="input" value={from}
          onChange={(e) => setFrom(e.target.value)}>
          <option value="">{initial.loggedIn ? "Use my profile" : "Choose…"}</option>
          {fromType === "career"
            ? list.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)
            : stages.data.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.name}</option>)}
        </select>
      </fieldset>
      <div className="field" style={{ margin: 0 }}>
        <label className="field__label" htmlFor="dream-to">Can I become</label>
        <select id="dream-to" className="input" value={to} onChange={(e) => setTo(e.target.value)} required>
          <option value="" disabled>Choose a dream career</option>
          {list.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn--primary" disabled={!to}>Check</button>
    </form>
  );
}

export default function DreamCheckPage() {
  const { status: authStatus } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(params.entries());
  const key = params.toString();
  const result = useRequest(
    (signal) => (!query.to || authStatus === "loading" ? Promise.resolve(null) : api.checkTransition(query, signal)),
    [key, authStatus],
  );
  const r = result.data;
  const verdict = r && VERDICTS[r.verdict];

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>Can I become…?</h1>
            <p className="muted">Check a dream career from where you are now: the route, time, exams, skills and honest blockers.</p>
          </div>
        </div>

        <Form key={key} initial={{ ...query, loggedIn: authStatus === "authenticated" }} onSubmit={(q) => setParams(q)} />

        {result.status === "loading" && query.to && <Loading label="Checking" />}
        {result.status === "error" && <ErrorNotice message={result.error} onRetry={result.reload} />}

        {r && (
          <div className="dream-result">
            <div className={`card verdict verdict--${verdict.tone}`} role="status">
              <p className="muted small">
                {r.from.career ? r.from.career.name : r.from.stage?.name} → {r.target.name}
                {r.source === "profile" && " (from your profile)"}
              </p>
              <h2>{verdict.title}</h2>
              {r.reasons.map((x) => <p key={x}>{x}</p>)}
              {months(r.time) && <p><strong>Typical time:</strong> {months(r.time)}</p>}
            </div>

            {r.blockers.length > 0 && (
              <section className="detail-block" aria-labelledby="blockers">
                <h2 id="blockers" className="group-title">Check before you commit</h2>
                <ul className="plain-list">{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </section>
            )}

            <div className="detail-grid">
              {r.education_route && (
                <section className="card detail-section">
                  <h2>Study route</h2>
                  <Route steps={r.education_route} />
                </section>
              )}
              {r.career_chain && (
                <section className="card detail-section">
                  <h2>Career moves</h2>
                  <Route steps={r.career_chain} />
                </section>
              )}
              {r.switch && (
                <section className="card detail-section">
                  <h2>Switch plan</h2>
                  <p className="muted small">{r.switch.difficulty} effort · about {r.switch.months_min}–{r.switch.months_max} months part-time</p>
                  <ol className="plain-list small">{r.switch.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                  {r.switch.skills_missing.length > 0 && <p className="small"><strong>Skills to add:</strong> {r.switch.skills_missing.join(", ")}</p>}
                  {r.switch.notes && <p className="small muted">{r.switch.notes}</p>}
                </section>
              )}
              <section className="card detail-section">
                <h2>Your skills for it</h2>
                <div className="score-list__head small"><span>Readiness</span><span>{Math.round(r.skills.readiness)}%</span></div>
                <Meter value={r.skills.readiness} label={`Skill readiness for ${r.target.name}`} />
                <p className="small">Core skills ready: {r.skills.core_ready} of {r.skills.core_total}
                  {r.time.skill_weeks > 0 && ` · roughly ${r.time.skill_weeks} weeks to cover the rest`}</p>
                {r.skills.learn_first.length > 0 && <p className="small muted">Learn first: {r.skills.learn_first.join(", ")}</p>}
                {!r.personalised && <p className="small"><Link to="/login">Log in</Link> to use your own skills.</p>}
                <div className="btn-row">
                  <Link to={`/skill-gap?career=${r.target.career_id}`} className="btn btn--secondary btn--small">Full skill gap</Link>
                  <Link to={`/roadmap?career=${r.target.career_id}`} className="btn btn--secondary btn--small">Roadmap</Link>
                </div>
              </section>
            </div>

            {r.alternatives.length > 0 && (
              <section className="detail-block" aria-labelledby="alts">
                <h2 id="alts" className="group-title">Closer options in the same area</h2>
                <ul className="plain-list">
                  {r.alternatives.map((a) => (
                    <li key={a.career_id}><Link to={`/careers/${a.career_id}`}>{a.name}</Link> <span className="muted small">– {a.why}</span></li>
                  ))}
                </ul>
              </section>
            )}
            <p className="notice small">Time ranges are typical, not promises. Eligibility and exam rules change; confirm on the official websites.</p>
          </div>
        )}
      </div>
    </section>
  );
}
