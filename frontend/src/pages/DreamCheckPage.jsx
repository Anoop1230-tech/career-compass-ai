import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

// Verdict titles: dream.verdict.<key> in i18n/*.js
const TONES = { direct: "ok", achievable: "ok", hard: "warn", not_direct: "danger" };

function months(t, time) {
  if (time.months_min == null) return null;
  const fmt = (m) => (m >= 24 && m % 12 === 0 ? t("next.years", { n: m / 12 }) : t("dream.months", { n: m }));
  return time.months_min === time.months_max ? fmt(time.months_min) : `${fmt(time.months_min)} – ${fmt(time.months_max)}`;
}

function Route({ steps }) {
  const { t } = useI18n();
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={`${s.id}-${i}`}>
          <strong>{s.type === "career" ? <Link to={`/careers/${s.id}`}>{s.title}</Link> : s.title}</strong>
          {s.years != null && <span className="muted small"> · {t("next.years", { n: s.years })}</span>}
          {s.years_experience && <span className="muted small"> · {t("dream.usuallyAfter", { n: s.years_experience })}</span>}
          {s.eligibility && <p className="small">{s.eligibility}</p>}
          {s.exams?.length > 0 && (
            <p className="small">
              {t("dream.exams")} {s.exams.map((e, j) => (
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
  const { t } = useI18n();
  const stages = useRequest(() => api.getStages(), []);
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  const [fromType, setFromType] = useState(initial.from_career ? "career" : "stage");
  const [from, setFrom] = useState(initial.from_career || initial.from_stage || "");
  const [to, setTo] = useState(initial.to || "");
  if (stages.status === "error" || careers.status === "error") {
    return <ErrorNotice message={stages.error || careers.error} onRetry={() => { stages.reload(); careers.reload(); }} />;
  }
  if (stages.status !== "ready" || careers.status !== "ready") return <Loading label={t("dream.loadingChoices")} minHeight={120} />;
  const list = careers.data.items;
  return (
    <form className="toolbar dream-form" onSubmit={(e) => {
      e.preventDefault();
      if (to) onSubmit({ to, ...(from ? { [fromType === "career" ? "from_career" : "from_stage"]: from } : {}) });
    }}>
      <fieldset className="field" style={{ margin: 0 }}>
        <legend className="field__label">{t("dream.iAm")}</legend>
        <div className="btn-row" style={{ marginBottom: "var(--space-2)" }}>
          {[["stage", t("dream.studying")], ["career", t("dream.workingAs")]].map(([value, label]) => (
            <label key={value} className="radio-inline small">
              <input type="radio" name="from-type" value={value} checked={fromType === value}
                onChange={() => { setFromType(value); setFrom(""); }} /> {label}
            </label>
          ))}
        </div>
        <select aria-label={fromType === "career" ? t("dream.currentCareer") : t("dream.currentStage")} className="input" value={from}
          onChange={(e) => setFrom(e.target.value)}>
          <option value="">{initial.loggedIn ? t("dream.useProfile") : t("common.select")}</option>
          {fromType === "career"
            ? list.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)
            : stages.data.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.name}</option>)}
        </select>
      </fieldset>
      <div className="field" style={{ margin: 0 }}>
        <label className="field__label" htmlFor="dream-to">{t("dream.canIBecome")}</label>
        <select id="dream-to" className="input" value={to} onChange={(e) => setTo(e.target.value)} required>
          <option value="" disabled>{t("dream.chooseDream")}</option>
          {list.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn--primary" disabled={!to}>{t("dream.check")}</button>
    </form>
  );
}

export default function DreamCheckPage() {
  const { status: authStatus } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(params.entries());
  const key = params.toString();
  const result = useRequest(
    (signal) => (!query.to || authStatus === "loading" ? Promise.resolve(null) : api.checkTransition(query, signal)),
    [key, authStatus],
  );
  const r = result.data;
  const verdict = r && { title: t(`dream.verdict.${r.verdict}`), tone: TONES[r.verdict] };

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("nav.dreamCheck")}</h1>
            <p className="muted">{t("dream.lead")}</p>
          </div>
        </div>

        <Form key={key} initial={{ ...query, loggedIn: authStatus === "authenticated" }} onSubmit={(q) => setParams(q)} />

        {result.status === "loading" && query.to && <Loading label={t("dream.checking")} />}
        {result.status === "error" && <ErrorNotice message={result.error} onRetry={result.reload} />}

        {r && (
          <div className="dream-result">
            <div className={`card verdict verdict--${verdict.tone}`} role="status">
              <p className="muted small">
                {r.from.career ? r.from.career.name : r.from.stage?.name} → {r.target.name}
                {r.source === "profile" && ` ${t("dream.fromProfile")}`}
              </p>
              <h2>{verdict.title}</h2>
              {r.reasons.map((x) => <p key={x}>{x}</p>)}
              {months(t, r.time) && <p><strong>{t("dream.typicalTime")}</strong> {months(t, r.time)}</p>}
            </div>

            {r.blockers.length > 0 && (
              <section className="detail-block" aria-labelledby="blockers">
                <h2 id="blockers" className="group-title">{t("dream.blockers")}</h2>
                <ul className="plain-list">{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </section>
            )}

            <div className="detail-grid">
              {r.education_route && (
                <section className="card detail-section">
                  <h2>{t("dream.studyRoute")}</h2>
                  <Route steps={r.education_route} />
                </section>
              )}
              {r.career_chain && (
                <section className="card detail-section">
                  <h2>{t("dream.careerMoves")}</h2>
                  <Route steps={r.career_chain} />
                </section>
              )}
              {r.switch && (
                <section className="card detail-section">
                  <h2>{t("dream.switchPlan")}</h2>
                  <p className="muted small">{t(`next.effort.${r.switch.difficulty}`)} · {t("dream.partTime", { min: r.switch.months_min, max: r.switch.months_max })}</p>
                  <ol className="plain-list small">{r.switch.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                  {r.switch.skills_missing.length > 0 && <p className="small"><strong>{t("dream.skillsToAdd")}</strong> {r.switch.skills_missing.join(", ")}</p>}
                  {r.switch.notes && <p className="small muted">{r.switch.notes}</p>}
                </section>
              )}
              <section className="card detail-section">
                <h2>{t("dream.yourSkills")}</h2>
                <div className="score-list__head small"><span>{t("dream.readiness")}</span><span>{Math.round(r.skills.readiness)}%</span></div>
                <Meter value={r.skills.readiness} label={t("dream.readinessFor", { name: r.target.name })} />
                <p className="small">{t("dream.coreReady", { n: r.skills.core_ready, total: r.skills.core_total })}
                  {r.time.skill_weeks > 0 && ` · ${t("dream.restWeeks", { n: r.time.skill_weeks })}`}</p>
                {r.skills.learn_first.length > 0 && <p className="small muted">{t("dream.learnFirst", { list: r.skills.learn_first.join(", ") })}</p>}
                {!r.personalised && <p className="small"><Link to="/login">{t("header.login")}</Link> {t("dream.loginHint")}</p>}
                <div className="btn-row">
                  <Link to={`/skill-gap?career=${r.target.career_id}`} className="btn btn--secondary btn--small">{t("dream.fullGap")}</Link>
                  <Link to={`/roadmap?career=${r.target.career_id}`} className="btn btn--secondary btn--small">{t("nav.roadmap")}</Link>
                </div>
              </section>
            </div>

            {r.alternatives.length > 0 && (
              <section className="detail-block" aria-labelledby="alts">
                <h2 id="alts" className="group-title">{t("dream.alternatives")}</h2>
                <ul className="plain-list">
                  {r.alternatives.map((a) => (
                    <li key={a.career_id}><Link to={`/careers/${a.career_id}`}>{a.name}</Link> <span className="muted small">– {a.why}</span></li>
                  ))}
                </ul>
              </section>
            )}
            <p className="notice small">{t("dream.disclaimer")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
