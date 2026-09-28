import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink, VerifiedBadge } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

const LEVEL_LABELS = {
  school: "School", diploma: "Diploma", ug: "Bachelor's", pg: "Master's",
  doctoral: "Doctorate", professional: "Working",
};
const GROUPS = [
  { key: "education", label: "Study further" },
  { key: "career", label: "Start a career" },
  { key: "exam", label: "Exams" },
  { key: "switches", label: "Switch paths" },
];

function years(value) {
  if (value == null) return null;
  return value === 1 ? "1 year" : `${value} years`;
}

function OptionCard({ option }) {
  const titleId = `opt-${option.path_id}`;
  return (
    <article className="card option-card" aria-labelledby={titleId}>
      <div className="option-card__head">
        <h3 id={titleId} className="option-card__title">
          {option.kind === "career" ? <Link to={`/careers/${option.target_id}`}>{option.title}</Link> : option.title}
        </h3>
        {option.duration_years != null && <span className="badge">{years(option.duration_years)}</span>}
      </div>
      {option.summary && <p className="muted small">{option.summary}</p>}

      {option.reasons.length > 0 && (
        <p className="small option-card__why">
          <strong>Fits you because</strong> {option.reasons.join("; ")}.
        </p>
      )}

      <dl className="dl small">
        <dt>Eligibility</dt>
        <dd>{option.eligibility}</dd>
        {option.exams.length > 0 && (
          <>
            <dt>Exams</dt>
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
            <dt>Leads to</dt>
            <dd>{option.opens.careers.map((c) => c.name).join(", ")}</dd>
          </>
        )}
      </dl>

      {option.skills && (
        <div className="option-card__skills">
          <div className="score-list__head small">
            <span>Skills you already have</span>
            <span className="muted">{Math.round(option.skills.coverage)}%</span>
          </div>
          <Meter value={option.skills.coverage} label={`Skills you have for ${option.title}`} />
          {option.skills.missing_core.length > 0 && (
            <p className="muted small" style={{ marginTop: "var(--space-2)" }}>
              Core skills to learn: {option.skills.missing_core.join(", ")}
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
        <strong>Next action:</strong> {option.next_action}
      </p>
      <div className="option-card__foot small muted">
        <VerifiedBadge verified={option.verified} date={option.last_verified} />
        {option.source_url && <OfficialLink href={option.source_url}>Source</OfficialLink>}
      </div>
    </article>
  );
}

function SwitchCard({ item }) {
  return (
    <article className="card option-card">
      <div className="option-card__head">
        <h3 className="option-card__title"><Link to={`/careers/${item.career_id}`}>{item.title}</Link></h3>
        <span className="badge">{item.difficulty} effort</span>
      </div>
      {item.months_min != null && (
        <p className="muted small">About {item.months_min}–{item.months_max} months of part-time preparation</p>
      )}
      <ol className="plain-list small">
        {item.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {item.skills_missing.length > 0 && (
        <p className="small" style={{ marginTop: "var(--space-3)" }}>
          <strong>Skills still needed:</strong> {item.skills_missing.join(", ")}
        </p>
      )}
      {item.notes && <p className="muted small">{item.notes}</p>}
    </article>
  );
}

function StagePicker({ stages, value, onChange }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of stages) {
      const key = LEVEL_LABELS[s.level] || s.level;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()];
  }, [stages]);
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label className="field__label" htmlFor="stage-select">Where are you now?</label>
      <select id="stage-select" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Choose your current stage</option>
        {grouped.map(([label, items]) => (
          <optgroup key={label} label={label}>
            {items.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.name}</option>)}
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
    ? Object.fromEntries(GROUPS.map((g) => [g.key, (g.key === "switches" ? result.switches : result.groups[g.key]).length]))
    : {};
  const visible = GROUPS.filter((g) => counts[g.key] > 0 && (tab === "all" || tab === g.key));

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>Next steps</h1>
            <p className="muted">Realistic options from where you are now, with eligibility, time, exams and one action to take.</p>
          </div>
          <div className="btn-row">
            <Link to="/explore" className="btn btn--secondary">Explore as a tree</Link>
            <Link to="/dream-check" className="btn btn--secondary">Can I become…?</Link>
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
                  Exploring another stage.{" "}
                  <button type="button" className="link-button" onClick={() => setParams({})}>Back to my stage</button>
                </p>
              )}
              {!ctx.logged_in && (
                <p><Link to="/login">Log in</Link> to start from your profile and see options ranked for you.</p>
              )}
              {ctx.logged_in && !ctx.has_profile && (
                <p><Link to="/profile/edit">Create your profile</Link> to rank these options for you.</p>
              )}
              {ctx.has_profile && !ctx.stage_exact && ctx.source === "profile" && (
                <p><Link to="/profile/edit">Update your education details</Link> for a closer match.</p>
              )}
            </div>
          )}
        </div>

        {steps.status === "loading" && <Loading label="Loading next steps" />}
        {steps.status === "error" && <ErrorNotice message={steps.error} onRetry={steps.reload} />}

        {steps.status === "ready" && !result && (
          <div className="notice" style={{ marginTop: "var(--space-5)" }}>
            <p style={{ margin: 0 }}>Choose your current stage above to see what you can do next.</p>
          </div>
        )}

        {steps.status === "ready" && result && (
          <>
            <div className="stage-summary">
              <h2>{result.stage.name}</h2>
              {result.stage.description && <p className="muted">{result.stage.description}</p>}
            </div>

            {result.counts.options === 0 && result.switches.length === 0 ? (
              <p className="notice">No next steps are recorded for this stage yet.</p>
            ) : (
              <div className="tabs" role="group" aria-label="Filter options">
                <button type="button" className="tab" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
                  All
                </button>
                {GROUPS.filter((g) => counts[g.key] > 0).map((g) => (
                  <button key={g.key} type="button" className="tab" aria-pressed={tab === g.key} onClick={() => setTab(g.key)}>
                    {g.label} <span className="tab__count">{counts[g.key]}</span>
                  </button>
                ))}
              </div>
            )}

            {visible.map((g) => (
              <section key={g.key} className="detail-block" aria-labelledby={`group-${g.key}`}>
                <h2 id={`group-${g.key}`} className="group-title">{g.label}</h2>
                <div className="option-grid">
                  {g.key === "switches"
                    ? result.switches.map((s) => <SwitchCard key={s.transition_id} item={s} />)
                    : result.groups[g.key].map((o) => <OptionCard key={o.path_id} option={o} />)}
                </div>
              </section>
            ))}

            {result.other_exams.length > 0 && (tab === "all" || tab === "exam") && (
              <section className="detail-block" aria-labelledby="other-exams">
                <h2 id="other-exams" className="group-title">Other exams open at this stage</h2>
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

            <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
              Eligibility, exam dates and rules change every year. Entries marked “Not yet verified” come from official
              sources but have not been re-checked for the current year. Always confirm on the official website before
              applying.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
