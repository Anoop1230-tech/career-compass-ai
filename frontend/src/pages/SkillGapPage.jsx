import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter } from "../components/Status";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

const STATUS_TEXT = { partial: "Improve", missing: "Learn" };

function weeks(n) {
  return n === 1 ? "1 week" : `${n} weeks`;
}

function GapTable({ items, caption }) {
  return (
    <div className="table-wrap">
      <table className="table table--stack">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Skill</th>
            <th scope="col">You now</th>
            <th scope="col">Needed</th>
            <th scope="col">Importance</th>
            <th scope="col">Rough time</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.skill_id}>
              <td data-label="Priority">{i.rank}</td>
              <th scope="row">
                <span className="gap-name">{i.name}</span>
                <span className={`badge badge--${i.status}`}>{STATUS_TEXT[i.status]}</span>
                {i.description && <span className="muted small gap-desc">{i.description}</span>}
              </th>
              <td data-label="You now">{i.current_level === "none" ? "–" : i.current_level}</td>
              <td data-label="Needed">{i.required_level}</td>
              <td data-label="Importance"><span role="img" aria-label={`Importance ${i.importance} out of 5`}>{"●".repeat(i.importance)}<span className="dim">{"●".repeat(5 - i.importance)}</span></span></td>
              <td data-label="Rough time">{weeks(i.weeks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CareerPicker({ value, onChange }) {
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  if (careers.status !== "ready") return null;
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label className="field__label" htmlFor="gap-career">Target career</label>
      <select id="gap-career" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Choose a career</option>
        {careers.data.items.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)}
      </select>
    </div>
  );
}

function Suggestions({ onPick }) {
  const rec = useRequest((signal) => api.getRecommendations({ limit: 3 }, signal), []);
  if (rec.status !== "ready" || rec.data.items.length === 0) return null;
  return (
    <div className="notice" style={{ marginTop: "var(--space-5)" }}>
      <p>Your top matches:</p>
      <div className="btn-row">
        {rec.data.items.map((i) => (
          <button key={i.career_id} type="button" className="btn btn--secondary btn--small" onClick={() => onPick(i.career_id)}>
            {i.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SkillGapPage() {
  const [params, setParams] = useSearchParams();
  const career = params.get("career") || "";
  const pick = (id) => setParams(id ? { career: id } : {});
  const gap = useRequest((signal) => (career ? api.getSkillGap(career, signal) : Promise.resolve(null)), [career]);

  if (gap.status === "error" && api.isNotFound(gap.raw) && /profile/i.test(gap.error)) {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>Create your profile first</h1>
          <p className="muted">The skill gap compares the skills in your profile with a career.</p>
          <Link to="/profile/edit" className="btn btn--primary">Create profile</Link>
        </div>
      </section>
    );
  }

  const d = gap.data;
  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>Skill gap</h1>
            <p className="muted">What you already have for a career, and what to learn first.</p>
          </div>
        </div>
        <div className="toolbar">
          <CareerPicker value={career} onChange={pick} />
          {d && (
            <p className="small muted" style={{ margin: 0 }}>
              <Link to={`/careers/${d.career.career_id}`}>About this career</Link> ·{" "}
              <Link to={`/roadmap?career=${d.career.career_id}`}>Turn this into a roadmap</Link>
            </p>
          )}
        </div>

        {!career && <Suggestions onPick={pick} />}
        {gap.status === "loading" && career && <Loading label="Loading skill gap" />}
        {gap.status === "error" && <ErrorNotice message={gap.error} onRetry={gap.reload} />}

        {d && (
          <>
            <div className="gap-summary">
              <div className="card summary-card">
                <p className="muted small">Readiness for {d.career.name}</p>
                <p className="summary-card__big">{Math.round(d.readiness)}%</p>
                <Meter value={d.readiness} label={`Readiness for ${d.career.name}`} />
              </div>
              <div className="card summary-card">
                <p className="muted small">Core skills ready</p>
                <p className="summary-card__big">{d.core_ready} / {d.core_total}</p>
              </div>
              <div className="card summary-card">
                <p className="muted small">Rough time for core skills</p>
                <p className="summary-card__big">{weeks(d.estimate.core_weeks)}</p>
                <p className="muted small">at about {d.estimate.hours_per_week} hours a week</p>
              </div>
            </div>

            {!d.has_skills && (
              <p className="notice">
                Your profile has no recognised skills yet, so everything shows as a gap.{" "}
                <Link to="/profile/edit">Add your skills</Link>.
              </p>
            )}

            {d.learn_first.length > 0 && (
              <section className="detail-block" aria-labelledby="learn-first">
                <h2 id="learn-first" className="group-title">Learn first: core skills</h2>
                <GapTable items={d.learn_first} caption="Core skills to learn, in priority order" />
              </section>
            )}
            {d.learn_next.length > 0 && (
              <section className="detail-block" aria-labelledby="learn-next">
                <h2 id="learn-next" className="group-title">Then: helpful skills</h2>
                <GapTable items={d.learn_next} caption="Helpful skills to learn next" />
              </section>
            )}
            {d.learn_first.length === 0 && d.learn_next.length === 0 && (
              <p className="notice">You have every listed skill at the needed level. Focus on projects and applying.</p>
            )}

            {d.have.length > 0 && (
              <section className="detail-block" aria-labelledby="have">
                <h2 id="have" className="group-title">You already have</h2>
                <ul className="tag-list">
                  {d.have.map((i) => <li key={i.skill_id} className="badge badge--ok">{i.name} · {i.current_level}</li>)}
                </ul>
              </section>
            )}
            {d.transferable.length > 0 && (
              <p className="small muted">Other skills you bring: {d.transferable.join(", ")}.</p>
            )}
            {d.unmatched_skills.length > 0 && (
              <p className="small muted">Not recognised (not counted): {d.unmatched_skills.join(", ")}.</p>
            )}
            <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
              Time estimates are rough planning numbers (3 weeks to reach beginner, 5 more for intermediate, 8 more for
              advanced) and vary a lot between people and skills. Skill levels come from your own profile ratings.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
