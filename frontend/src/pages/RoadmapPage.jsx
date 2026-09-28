import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

function duration(weeks) {
  if (!weeks) return null;
  if (weeks >= 52) return `about ${Math.round((weeks / 52) * 10) / 10} years`;
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

function CareerChooser({ onPick, loggedIn }) {
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  const recs = useRequest(
    (signal) => (loggedIn ? api.getRecommendations({ limit: 3 }, signal).catch(() => null) : Promise.resolve(null)),
    [loggedIn],
  );
  return (
    <div className="toolbar">
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field__label" htmlFor="roadmap-career">Target career</label>
        <select id="roadmap-career" className="input" defaultValue="" onChange={(e) => onPick(e.target.value)}>
          <option value="" disabled>Choose a career</option>
          {careers.data?.items.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)}
        </select>
      </div>
      {recs.data?.items?.length > 0 && (
        <div className="small">
          <p className="muted" style={{ margin: "0 0 var(--space-2)" }}>Your top matches:</p>
          <div className="btn-row">
            {recs.data.items.map((i) => (
              <button key={i.career_id} type="button" className="btn btn--secondary btn--small" onClick={() => onPick(i.career_id)}>
                {i.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function withSkill(roadmap, skillId, done) {
  return {
    ...roadmap,
    stages: roadmap.stages.map((s) => ({
      ...s, items: s.items.map((i) => (i.skill_id === skillId ? { ...i, done } : i)),
    })),
  };
}

function StageItem({ item, canTick, busy, onToggle }) {
  if (item.kind === "skill") {
    const id = `skill-${item.skill_id}`;
    return (
      <li className={`roadmap-item${item.done ? " roadmap-item--done" : ""}`}>
        {canTick ? (
          <input id={id} type="checkbox" checked={item.done} disabled={busy} onChange={(e) => onToggle(item.skill_id, e.target.checked)} />
        ) : <span className="roadmap-item__dot" aria-hidden="true" />}
        <div>
          <label htmlFor={canTick ? id : undefined} className="roadmap-item__title">
            {item.name}{item.is_mandatory && <span className="badge" style={{ marginLeft: 6 }}>core</span>}
          </label>
          <p className="muted small">
            {item.from_level === "none" ? "Start" : `From ${item.from_level}`} → {item.to_level} · {duration(item.weeks)}
            {item.description ? ` · ${item.description}` : ""}
          </p>
        </div>
      </li>
    );
  }
  return (
    <li className="roadmap-item">
      <span className="roadmap-item__dot" aria-hidden="true" />
      <div>
        <p className="roadmap-item__title">{item.title}{item.years ? ` · ${item.years} years` : ""}</p>
        {item.detail && <p className="muted small">{item.detail}</p>}
        {item.exams?.length > 0 && (
          <p className="small">
            {item.exams.map((e, i) => (
              <span key={e.exam_id}>{i > 0 && ", "}<OfficialLink href={e.official_url}>{e.name}</OfficialLink>
                {e.typical_month ? <span className="muted"> ({e.typical_month})</span> : null}</span>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

export default function RoadmapPage() {
  const { status: authStatus } = useAuth();
  const loggedIn = authStatus === "authenticated";
  const [params, setParams] = useSearchParams();
  const career = params.get("career");
  const choosing = params.get("choose") === "1";
  // Updates after ticking a skill; tied to the loaded data so a new load replaces them
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const req = useRequest((signal) => {
    if (authStatus === "loading") return new Promise(() => {});
    if (career) return api.getRoadmap(career, signal);
    if (choosing) return Promise.resolve(null);
    if (loggedIn) return api.getMyRoadmap(signal).catch((err) => (api.isNotFound(err) ? null : Promise.reject(err)));
    return Promise.resolve(null);
  }, [career, choosing, authStatus]);
  const [updated, setUpdated] = useState(null);
  const roadmap = updated && updated.base === req.data ? updated.value : req.data;

  const act = async (fn, rollback) => {
    setBusy(true);
    setActionError(null);
    try {
      const value = await fn();
      setUpdated({ base: req.data, value });
    } catch (err) {
      if (rollback) setUpdated({ base: req.data, value: rollback });
      setActionError(api.getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const r = roadmap;
  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{r ? `Roadmap: ${r.career.name}` : "Career roadmap"}</h1>
            <p className="muted">A stage-by-stage plan that skips what you already know.</p>
          </div>
          {r && (
            <div className="btn-row">
              {r.logged_in && !r.is_target && (
                <button type="button" className="btn btn--primary" disabled={busy}
                  onClick={() => act(() => api.setRoadmapTarget(r.career.career_id))}>Set as my target</button>
              )}
              {r.is_target && <span className="badge badge--ok">Your target career</span>}
              <button type="button" className="btn btn--secondary" onClick={() => setParams({ choose: "1" })}>
                Change career
              </button>
            </div>
          )}
        </div>

        {req.status === "loading" && <Loading label="Loading roadmap" />}
        {req.status === "error" && <ErrorNotice message={req.error} onRetry={req.reload} />}
        {actionError && <ErrorNotice message={actionError} />}

        {req.status === "ready" && !r && (
          <>
            <CareerChooser loggedIn={loggedIn} onPick={(id) => setParams({ career: id })} />
            {!loggedIn && (
              <p className="notice" style={{ marginTop: "var(--space-5)" }}>
                <Link to="/login">Log in</Link> to get a roadmap that skips the skills you already have and to track progress.
              </p>
            )}
          </>
        )}

        {r && (
          <>
            <div className="gap-summary">
              <div className="card summary-card">
                <p className="muted small">Skills learned</p>
                <p className="summary-card__big">{r.progress.done} / {r.progress.total}</p>
                <Meter value={r.progress.percent} label="Roadmap progress" />
              </div>
              <div className="card summary-card">
                <p className="muted small">Rough time left (skills and projects)</p>
                <p className="summary-card__big">{duration(r.total_weeks) || "Done"}</p>
                <p className="muted small">at about {r.hours_per_week} hours a week{r.study_years ? `, plus ${r.study_years} years of study` : ""}</p>
              </div>
              {r.stage && (
                <div className="card summary-card">
                  <p className="muted small">Starting from</p>
                  <p className="summary-card__big summary-card__big--text">{r.stage.name}</p>
                </div>
              )}
            </div>

            {!r.personalised && (
              <p className="notice">
                {r.logged_in ? <><Link to="/profile/edit">Add your profile</Link> so the roadmap can skip what you know.</>
                  : <><Link to="/login">Log in</Link> to personalise this roadmap and tick off skills.</>}
              </p>
            )}

            <ol className="roadmap">
              {r.stages.map((s) => (
                <li key={s.key} className="card roadmap-stage" aria-labelledby={`stage-${s.key}`}>
                  <div className="roadmap-stage__head">
                    <span className="roadmap-stage__num" aria-hidden="true">{s.order}</span>
                    <div>
                      <h2 id={`stage-${s.key}`}>{s.title}</h2>
                      <p className="muted small">{s.summary}{duration(s.weeks) ? ` · ${duration(s.weeks)}` : ""}</p>
                    </div>
                  </div>
                  <ul className="roadmap-items">
                    {s.items.map((item, i) => (
                      <StageItem key={item.skill_id || `${s.key}-${i}`} item={item} canTick={r.logged_in} busy={busy}
                        onToggle={(skillId, done) => {
                          // Show the tick immediately; the server response then replaces it
                          setUpdated({ base: req.data, value: withSkill(r, skillId, done) });
                          act(() => api.markRoadmapSkill(r.career.career_id, skillId, done), r);
                        }} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>

            {r.skipped.length > 0 && (
              <p className="small muted">Skipped because you already have them: {r.skipped.map((s) => `${s.name} (${s.level})`).join(", ")}.</p>
            )}
            <p className="notice small">
              Time estimates are rough planning numbers. Ticking a skill here tracks your roadmap; to change the level
              used everywhere else, update the skill in <Link to="/profile/edit">your profile</Link>.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
