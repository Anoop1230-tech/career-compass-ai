import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink, VerifiedBadge } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import { branchName, foldFamilies, groupStages } from "../degreeFamilies";
import { useI18n } from "../i18n";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

// Texts: next.level.<level>, next.group.<key> (+ .hint) in i18n/*.js
const GROUPS = [{ key: "education" }, { key: "course", hint: true }, { key: "career" }, { key: "exam" }, { key: "switches" }];

function years(t, value) {
  if (value == null) return null;
  return value === 1 ? t("next.oneYear") : t("next.years", { n: value });
}

/** Professional courses are open at every stage, so they are shown even before a stage is chosen. */
function OpenCourses({ stages }) {
  const { t } = useI18n();
  const courses = stages.filter((s) => s.level === "course");
  if (!courses.length) return null;
  return (
    <section className="detail-block" aria-labelledby="open-courses">
      <h2 id="open-courses" className="group-title">{t("next.openCourses")}</h2>
      <p className="muted small">{t("next.openCourses.text")}</p>
      <ul className="stage-grid">
        {courses.map((c) => (
          <li key={c.stage_id}>
            <Link to={`/next-steps?stage=${c.stage_id}`} className="stage-card">
              <span>
                <strong>{c.name.replace("Professional course – ", "")}</strong>
                <span className="muted">{c.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OptionCard({ option }) {
  const { t } = useI18n();
  const titleId = `opt-${option.path_id}`;
  return (
    <article className="card option-card" aria-labelledby={titleId}>
      <div className="option-card__head">
        <h3 id={titleId} className="option-card__title">
          {option.kind === "career" ? <Link to={`/careers/${option.target_id}`}>{option.title}</Link> : option.title}
        </h3>
        {option.duration_years != null && <span className="badge">{years(t, option.duration_years)}</span>}
      </div>
      {option.summary && <p className="muted small">{option.summary}</p>}

      {option.reasons.length > 0 && (
        <p className="small option-card__why">
          <strong>{t("next.fitsBecause")}</strong> {option.reasons.join("; ")}.
        </p>
      )}

      <dl className="dl small">
        <dt>{t("next.eligibility")}</dt>
        <dd>{option.eligibility}</dd>
        {option.exams.length > 0 && (
          <>
            <dt>{t("next.group.exam")}</dt>
            <dd>
              {option.exams.map((e, i) => (
                <span key={e.exam_id}>
                  {i > 0 && ", "}
                  <OfficialLink href={e.official_url}>{e.name}</OfficialLink>
                  {e.typical_month && <span className="muted"> ({e.typical_month})</span>}
                </span>
              ))}
            </dd>
          </>
        )}
        {option.opens && option.opens.careers.length > 0 && (
          <>
            <dt>{t("next.leadsTo")}</dt>
            <dd>{option.opens.careers.map((c) => c.name).join(", ")}</dd>
          </>
        )}
      </dl>

      {option.skills && (
        <div className="option-card__skills">
          <div className="score-list__head small">
            <span>{t("next.skillsHave")}</span>
            <span className="muted">{Math.round(option.skills.coverage)}%</span>
          </div>
          <Meter value={option.skills.coverage} label={t("next.skillsHaveFor", { title: option.title })} />
          {option.skills.missing_core.length > 0 && (
            <p className="muted small" style={{ marginTop: "var(--space-2)" }}>
              {t("next.coreToLearn", { list: option.skills.missing_core.join(", ") })}
            </p>
          )}
        </div>
      )}

      {(option.advantages || option.limitations) && (
        <ul className="pros-cons small">
          {option.advantages && <li className="pros-cons__pro"><span aria-hidden="true">+</span> {option.advantages}</li>}
          {option.limitations && <li className="pros-cons__con"><span aria-hidden="true">−</span> {option.limitations}</li>}
        </ul>
      )}

      <p className="next-action small">
        <strong>{t("next.nextAction")}</strong> {option.next_action}
      </p>
      <div className="option-card__foot small muted">
        <VerifiedBadge verified={option.verified} date={option.last_verified} />
        {option.source_url && <OfficialLink href={option.source_url}>{t("common.source")}</OfficialLink>}
        {option.kind === "education" && <Link to={`/fees?stage=${option.target_id}`}>{t("next.seeFees")}</Link>}
      </div>
    </article>
  );
}

const BRANCHES_SHOWN = 6;

/** One card for a degree (e.g. B.Tech) with every branch under it; each branch opens its own next steps. */
function BranchGroupCard({ family, options }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const titleId = `family-${family.key}`;
  const first = options[0];
  const exams = [...new Map(options.flatMap((o) => o.exams).map((e) => [e.exam_id, e])).values()];
  const shown = all ? options : options.slice(0, BRANCHES_SHOWN);
  return (
    <article className="card option-card option-card--family" aria-labelledby={titleId}>
      <div className="option-card__head">
        <h3 id={titleId} className="option-card__title">{t(`family.${family.key}`)}</h3>
        {first.duration_years != null && <span className="badge">{years(t, first.duration_years)}</span>}
      </div>
      <p className="muted small">{t("next.branchesLead", { n: options.length })}</p>
      <dl className="dl small">
        <dt>{t("next.eligibility")}</dt>
        <dd>{first.eligibility}</dd>
        {exams.length > 0 && (
          <>
            <dt>{t("next.group.exam")}</dt>
            <dd>
              {exams.map((e, i) => (
                <span key={e.exam_id}>
                  {i > 0 && ", "}
                  <OfficialLink href={e.official_url}>{e.name}</OfficialLink>
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
      <ul className="branch-list">
        {shown.map((o) => (
          <li key={o.path_id}>
            <Link to={`/next-steps?stage=${o.target_id}`} className="branch-list__name">{branchName(o.title)}</Link>
            {o.advantages && <span className="muted small"> – {o.advantages}</span>}
          </li>
        ))}
      </ul>
      {options.length > BRANCHES_SHOWN && (
        <button type="button" className="link-button small" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t("next.fewerBranches") : t("next.allBranches", { n: options.length })}
        </button>
      )}
      <p className="small" style={{ marginTop: "var(--space-3)" }}>
        <Link to={`/fees?stage=${first.target_id}`}>{t("next.seeFees")}</Link>
      </p>
    </article>
  );
}

function SwitchCard({ item }) {
  const { t } = useI18n();
  return (
    <article className="card option-card">
      <div className="option-card__head">
        <h3 className="option-card__title"><Link to={`/careers/${item.career_id}`}>{item.title}</Link></h3>
        <span className="badge">{t(`next.effort.${item.difficulty}`)}</span>
      </div>
      {item.months_min != null && (
        <p className="muted small">{t("next.months", { min: item.months_min, max: item.months_max })}</p>
      )}
      <ol className="plain-list small">
        {item.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {item.skills_missing.length > 0 && (
        <p className="small" style={{ marginTop: "var(--space-3)" }}>
          <strong>{t("next.skillsNeeded")}</strong> {item.skills_missing.join(", ")}
        </p>
      )}
      {item.notes && <p className="muted small">{item.notes}</p>}
    </article>
  );
}

function StagePicker({ stages, value, onChange }) {
  const { t } = useI18n();
  const grouped = useMemo(() => groupStages(stages, t), [stages, t]);
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label className="field__label" htmlFor="stage-select">{t("profile.f.stage")}</label>
      <select id="stage-select" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{t("profile.f.stage.placeholder")}</option>
        {grouped.map(([label, items]) => (
          <optgroup key={label} label={label}>
            {items.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export default function NextStepsPage() {
  const { user, status: authStatus } = useAuth();
  const [params, setParams] = useSearchParams();
  const chosen = params.get("stage") || undefined;
  const [tab, setTab] = useState("all");
  const { t } = useI18n();

  const stages = useRequest(() => api.getStages(), []);
  // Wait until we know who is logged in, so the page loads once, not twice
  const steps = useRequest(
    (signal) => (authStatus === "loading" ? new Promise(() => {}) : api.getNextSteps(chosen, signal)),
    [chosen, authStatus, user?.id],
  );

  const data = steps.data;
  const result = data?.result;
  const ctx = data?.context;
  const selected = chosen || result?.stage.stage_id;

  const counts = result
    ? Object.fromEntries(GROUPS.map((g) => [g.key, g.key === "switches" ? result.switches.length
      : g.key === "education" ? foldFamilies(result.groups.education || [], (o) => o.target_id).length
        : (result.groups[g.key] || []).length]))
    : {};
  const visible = GROUPS.filter((g) => counts[g.key] > 0 && (tab === "all" || tab === g.key));

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("next.title")}</h1>
            <p className="muted">{t("next.lead")}</p>
          </div>
          <div className="btn-row">
            <Link to="/explore" className="btn btn--secondary">{t("next.asTree")}</Link>
            <Link to="/dream-check" className="btn btn--secondary">{t("nav.dreamCheck")}</Link>
          </div>
        </div>

        <div className="toolbar">
          {stages.status === "ready" ? (
            <StagePicker
              stages={stages.data}
              value={selected}
              onChange={(value) => {
                setTab("all");
                setParams(value ? { stage: value } : {});
              }}
            />
          ) : stages.status === "error" ? (
            <ErrorNotice message={stages.error} onRetry={stages.reload} />
          ) : null}
          {ctx && (
            <div className="toolbar__note small muted">
              {ctx.source === "profile" && ctx.stage_note && <p>{ctx.stage_note}</p>}
              {ctx.source === "query" && ctx.profile_stage_id && ctx.profile_stage_id !== chosen && (
                <p>
                  {t("next.otherStage")}{" "}
                  <button type="button" className="link-button" onClick={() => setParams({})}>{t("next.backToMine")}</button>
                </p>
              )}
              {!ctx.logged_in && (
                <p><Link to="/login">{t("header.login")}</Link> {t("next.loginHint")}</p>
              )}
              {ctx.logged_in && !ctx.has_profile && (
                <p><Link to="/profile/quick">{t("profile.create")}</Link> {t("next.profileHint")}</p>
              )}
              {ctx.has_profile && !ctx.stage_exact && ctx.source === "profile" && (
                <p><Link to="/profile/edit">{t("next.updateEducation")}</Link> {t("next.closerMatch")}</p>
              )}
            </div>
          )}
        </div>

        {steps.status === "loading" && <Loading label={t("next.loading")} />}
        {steps.status === "error" && <ErrorNotice message={steps.error} onRetry={steps.reload} />}

        {steps.status === "ready" && !result && (
          <>
            <div className="notice" style={{ marginTop: "var(--space-5)" }}>
              <p style={{ margin: 0 }}>{t("next.chooseStage")}</p>
            </div>
            {stages.status === "ready" && <OpenCourses stages={stages.data} />}
          </>
        )}

        {steps.status === "ready" && result && (
          <>
            <div className="stage-summary">
              <h2>{result.stage.name}</h2>
              {result.stage.description && <p className="muted">{result.stage.description}</p>}
            </div>

            {result.counts.options === 0 && result.switches.length === 0 ? (
              <p className="notice">{t("next.none")}</p>
            ) : (
              <div className="tabs" role="group" aria-label={t("next.filter")}>
                <button type="button" className="tab" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
                  {t("common.all")}
                </button>
                {GROUPS.filter((g) => counts[g.key] > 0).map((g) => (
                  <button key={g.key} type="button" className="tab" aria-pressed={tab === g.key} onClick={() => setTab(g.key)}>
                    {t(`next.group.${g.key}`)} <span className="tab__count">{counts[g.key]}</span>
                  </button>
                ))}
              </div>
            )}

            {visible.map((g) => (
              <section key={g.key} className="detail-block" aria-labelledby={`group-${g.key}`}>
                <h2 id={`group-${g.key}`} className="group-title">{t(`next.group.${g.key}`)}</h2>
                {g.hint && <p className="muted small" style={{ marginTop: "calc(var(--space-2) * -1)" }}>{t(`next.group.${g.key}.hint`)}</p>}
                <div className="option-grid">
                  {g.key === "switches"
                    ? result.switches.map((s) => <SwitchCard key={s.transition_id} item={s} />)
                    : g.key === "education"
                      ? foldFamilies(result.groups.education, (o) => o.target_id).map((e) => (e.family
                        ? <BranchGroupCard key={e.family.key} family={e.family} options={e.items} />
                        : <OptionCard key={e.item.path_id} option={e.item} />))
                      : result.groups[g.key].map((o) => <OptionCard key={o.path_id} option={o} />)}
                </div>
              </section>
            ))}

            {result.other_exams.length > 0 && (tab === "all" || tab === "exam") && (
              <section className="detail-block" aria-labelledby="other-exams">
                <h2 id="other-exams" className="group-title">{t("next.otherExams")}</h2>
                <ul className="plain-list small">
                  {result.other_exams.map((e) => (
                    <li key={e.exam_id}>
                      <OfficialLink href={e.official_url}>{e.name}</OfficialLink>
                      <span className="muted"> – {e.full_name}{e.typical_month ? ` · ${e.typical_month}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="notice small" style={{ marginTop: "var(--space-6)" }}>{t("next.disclaimer")}</p>
          </>
        )}
      </div>
    </section>
  );
}
