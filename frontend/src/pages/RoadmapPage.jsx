import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

function duration(t, weeks) {
  if (!weeks) return null;
  if (weeks >= 52) return t("road.aboutYears", { n: Math.round((weeks / 52) * 10) / 10 });
  return weeks === 1 ? t("gap.oneWeek") : t("gap.weeks", { n: weeks });
}

function CareerChooser({ onPick, loggedIn }) {
  const { t } = useI18n();
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  const recs = useRequest(
    (signal) => (loggedIn ? api.getRecommendations({ limit: 3 }, signal).catch(() => null) : Promise.resolve(null)),
    [loggedIn],
  );
  return (
    <div className="toolbar">
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field__label" htmlFor="roadmap-career">{t("gap.target")}</label>
        <select id="roadmap-career" className="input" defaultValue="" onChange={(e) => onPick(e.target.value)}>
          <option value="" disabled>{t("gap.chooseCareer")}</option>
          {careers.data?.items.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)}
        </select>
      </div>
      {recs.data?.items?.length > 0 && (
        <div className="small">
          <p className="muted" style={{ margin: "0 0 var(--space-2)" }}>{t("gap.topMatches")}</p>
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

// Cost labels: road.cost.<free|freemium|paid> in i18n/*.js

function Courses({ courses, skillName }) {
  const { t } = useI18n();
  if (!courses?.length) return null;
  return (
    <ul className="roadmap-courses small" aria-label={t("road.coursesFor", { name: skillName })}>
      {courses.map((c) => (
        <li key={c.course_id}>
          <OfficialLink href={c.url}>{c.name}</OfficialLink>
          <span className="muted"> · {c.provider} · {["free", "freemium", "paid"].includes(c.cost_type) ? t(`road.cost.${c.cost_type}`) : c.cost_type}</span>
        </li>
      ))}
    </ul>
  );
}

function withStep(roadmap, projectId, index, done) {
  return {
    ...roadmap,
    stages: roadmap.stages.map((s) => ({
      ...s,
      items: s.items.map((i) => {
        if (i.project_id !== projectId) return i;
        const steps = i.steps.map((st) => (st.index === index ? { ...st, done } : st));
        return { ...i, steps, steps_done: steps.filter((st) => st.done).length };
      }),
    })),
  };
}

/** A project brief: what to build, which skills it shows, and a checklist you can tick when logged in. */
function ProjectItem({ item, canTick, busy, onStep }) {
  const { t } = useI18n();
  const finished = item.steps_done === item.steps.length;
  return (
    <li className={`roadmap-item roadmap-project${finished ? " roadmap-item--done" : ""}`}>
      <span className="roadmap-item__dot" aria-hidden="true" />
      <div>
        <h3 className="roadmap-item__title roadmap-project__title">
          {item.title}{" "}
          <span className="badge">{t(`gap.level.${item.level}`)}</span>{" "}
          <span className="muted small">{t("road.project.hours", { n: item.hours })}</span>
        </h3>
        <p className="small">{item.summary}</p>
        <p className="muted small">{t("road.project.skills", { list: item.skills.join(", ") })}</p>
        <ol className="project-steps small" aria-label={t("road.project.checklist", { name: item.title })}>
          {item.steps.map((s) => {
            const id = `step-${item.project_id}-${s.index}`;
            return (
              <li key={s.index} className={s.done ? "project-step project-step--done" : "project-step"}>
                {canTick ? (
                  <>
                    <input id={id} type="checkbox" checked={s.done} disabled={busy}
                      onChange={(e) => onStep(item.project_id, s.index, e.target.checked)} />
                    <label htmlFor={id}>{s.text}</label>
                  </>
                ) : <span>{s.text}</span>}
              </li>
            );
          })}
        </ol>
        <p className="small"><strong>{t("road.project.deliverable")}</strong> {item.deliverable}
          {canTick && <span className="muted"> · {t("road.project.progress", { done: item.steps_done, total: item.steps.length })}</span>}</p>
      </div>
    </li>
  );
}

function StageItem({ item, canTick, busy, onToggle }) {
  const { t } = useI18n();
  if (item.kind === "skill") {
    const id = `skill-${item.skill_id}`;
    return (
      <li className={`roadmap-item${item.done ? " roadmap-item--done" : ""}`}>
        {canTick ? (
          <input id={id} type="checkbox" checked={item.done} disabled={busy} onChange={(e) => onToggle(item.skill_id, e.target.checked)} />
        ) : <span className="roadmap-item__dot" aria-hidden="true" />}
        <div>
          <label htmlFor={canTick ? id : undefined} className="roadmap-item__title">
            {item.name}{item.is_mandatory && <span className="badge" style={{ marginLeft: 6 }}>{t("road.core")}</span>}
          </label>
          <p className="muted small">
            {item.from_level === "none" ? t("road.start") : t("road.from", { level: t(`gap.level.${item.from_level}`) })} → {t(`gap.level.${item.to_level}`)} · {duration(t, item.weeks)}
            {item.description ? ` · ${item.description}` : ""}
          </p>
          {!item.done && <Courses courses={item.courses} skillName={item.name} />}
        </div>
      </li>
    );
  }
  return (
    <li className="roadmap-item">
      <span className="roadmap-item__dot" aria-hidden="true" />
      <div>
        <p className="roadmap-item__title">{item.title}{item.years ? ` · ${t("next.years", { n: item.years })}` : ""}</p>
        {item.detail && <p className="muted small">{item.detail}</p>}
        {item.certifications?.length > 0 && (
          <ul className="roadmap-courses small" aria-label={t("road.certifications")}>
            {item.certifications.map((c) => (
              <li key={c.certification_id}>
                <OfficialLink href={c.url}>{c.name}</OfficialLink>
                <span className="muted"> · {c.issuing_body} · {c.level}</span>
              </li>
            ))}
          </ul>
        )}
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
  const { t } = useI18n();
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
            <h1>{r ? t("road.titleFor", { name: r.career.name }) : t("road.title")}</h1>
            <p className="muted">{t("road.lead")}</p>
          </div>
          {r && (
            <div className="btn-row">
              {r.logged_in && !r.is_target && (
                <button type="button" className="btn btn--primary" disabled={busy}
                  onClick={() => act(() => api.setRoadmapTarget(r.career.career_id))}>{t("road.setTarget")}</button>
              )}
              {r.is_target && <span className="badge badge--ok">{t("road.isTarget")}</span>}
              <button type="button" className="btn btn--secondary" onClick={() => setParams({ choose: "1" })}>
                {t("road.change")}
              </button>
            </div>
          )}
        </div>

        {req.status === "loading" && <Loading label={t("road.loading")} />}
        {req.status === "error" && <ErrorNotice message={req.error} onRetry={req.reload} />}
        {actionError && <ErrorNotice message={actionError} />}

        {req.status === "ready" && !r && (
          <>
            <CareerChooser loggedIn={loggedIn} onPick={(id) => setParams({ career: id })} />
            {!loggedIn && (
              <p className="notice" style={{ marginTop: "var(--space-5)" }}>
                <Link to="/login">{t("header.login")}</Link> {t("road.loginHint")}
              </p>
            )}
          </>
        )}

        {r && (
          <>
            <div className="gap-summary">
              <div className="card summary-card">
                <p className="muted small">{t("road.learned")}</p>
                <p className="summary-card__big">{r.progress.done} / {r.progress.total}</p>
                <Meter value={r.progress.percent} label={t("road.progress")} />
              </div>
              {r.projects_progress?.total > 0 && (
                <div className="card summary-card">
                  <p className="muted small">{t("road.projectsDone")}</p>
                  <p className="summary-card__big">{r.projects_progress.done} / {r.projects_progress.total}</p>
                </div>
              )}
              <div className="card summary-card">
                <p className="muted small">{t("road.timeLeft")}</p>
                <p className="summary-card__big">{duration(t, r.total_weeks) || t("road.done")}</p>
                <p className="muted small">{t("gap.hoursPerWeek", { n: r.hours_per_week })}{r.study_years ? t("road.plusStudy", { n: r.study_years }) : ""}</p>
              </div>
              {r.stage && (
                <div className="card summary-card">
                  <p className="muted small">{t("road.startingFrom")}</p>
                  <p className="summary-card__big summary-card__big--text">{r.stage.name}</p>
                </div>
              )}
            </div>

            {!r.personalised && (
              <p className="notice">
                {r.logged_in ? <><Link to="/profile/edit">{t("road.addProfile")}</Link> {t("road.addProfileHint")}</>
                  : <><Link to="/login">{t("header.login")}</Link> {t("road.loginTick")}</>}
              </p>
            )}

            <ol className="roadmap">
              {r.stages.map((s) => (
                <li key={s.key} className="card roadmap-stage" aria-labelledby={`stage-${s.key}`}>
                  <div className="roadmap-stage__head">
                    <span className="roadmap-stage__num" aria-hidden="true">{s.order}</span>
                    <div>
                      <h2 id={`stage-${s.key}`}>{s.title}</h2>
                      <p className="muted small">{s.summary}{duration(t, s.weeks) ? ` · ${duration(t, s.weeks)}` : ""}</p>
                    </div>
                  </div>
                  <ul className="roadmap-items">
                    {s.items.map((item, i) => (item.kind === "project" ? (
                      <ProjectItem key={item.project_id} item={item} canTick={r.logged_in} busy={busy}
                        onStep={(projectId, index, done) => {
                          setUpdated({ base: req.data, value: withStep(r, projectId, index, done) });
                          act(() => api.markProjectStep(r.career.career_id, projectId, index, done), r);
                        }} />
                    ) : (
                      <StageItem key={item.skill_id || `${s.key}-${i}`} item={item} canTick={r.logged_in} busy={busy}
                        onToggle={(skillId, done) => {
                          // Show the tick immediately; the server response then replaces it
                          setUpdated({ base: req.data, value: withSkill(r, skillId, done) });
                          act(() => api.markRoadmapSkill(r.career.career_id, skillId, done), r);
                        }} />
                    )))}
                  </ul>
                </li>
              ))}
            </ol>

            {r.skipped.length > 0 && (
              <p className="small muted">{t("road.skipped", { list: r.skipped.map((s) => `${s.name} (${t(`gap.level.${s.level}`)})`).join(", ") })}</p>
            )}
            <p className="notice small">
              {t("road.disclaimer")} <Link to="/profile/edit">{t("road.yourProfile")}</Link>.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
