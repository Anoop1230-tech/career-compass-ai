import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../services/api";

const LEVEL_LABELS = {
  school: "No degree needed", course: "Professional course", diploma: "Diploma", ug: "Bachelor's degree", pg: "Master's degree",
  doctoral: "Doctorate", professional: "Work experience",
};
const RIASEC = {
  R: "Realistic (hands-on)", I: "Investigative (analytical)", A: "Artistic (creative)",
  S: "Social (helping people)", E: "Enterprising (leading)", C: "Conventional (organised)",
};
const TYPE_LABELS = { promotion: "Promotion", specialization: "Specialization", lateral: "Switch", management: "Management" };
const pretty = (value) => value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

function Section({ title, children }) {
  return (
    <section className="card detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CareerLinks({ items, empty }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="plain-list">
      {items.map((c) => (
        <li key={`${c.career_id}-${c.transition_type}`}>
          <Link to={`/careers/${c.career_id}`}>{c.name}</Link>
          <span className="muted">
            {" "}· {TYPE_LABELS[c.transition_type] || c.transition_type}
            {c.typical_years_experience ? ` · ${c.typical_years_experience} yrs` : ""}
          </span>
          {c.notes && <div className="muted small">{c.notes}</div>}
        </li>
      ))}
    </ul>
  );
}

export default function CareerDetailPage() {
  const { careerId } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getCareer(careerId)
      .then((career) => {
        if (!active) return;
        setState({ status: "ready", career });
        document.title = `${career.name} – Career Compass AI`;
      })
      .catch((err) => active && setState({ status: api.isNotFound(err) ? "missing" : "error", error: api.getErrorMessage(err) }));
    return () => {
      active = false;
      document.title = "Career Compass AI";
    };
  }, [careerId, attempt]);

  if (state.status === "loading") {
    return (
      <div className="page-center" role="status" aria-label="Loading career">
        <div className="loader" />
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <span className="badge">404</span>
          <h1 style={{ marginTop: "var(--space-4)" }}>Career not found</h1>
          <p className="muted">This career may have been renamed or removed.</p>
          <Link to="/careers" className="btn btn--primary">Browse all careers</Link>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>Could not load this career</h1>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const c = state.career;
  const mandatory = c.skills.filter((s) => s.is_mandatory);
  const helpful = c.skills.filter((s) => !s.is_mandatory);

  return (
    <section className="page">
      <div className="container">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/careers">Careers</Link> <span aria-hidden="true">/</span> <span>{c.name}</span>
        </nav>

        <header className="detail-head">
          <span className="badge">{c.domain}{c.sub_domain ? ` · ${c.sub_domain}` : ""}</span>
          <h1>{c.name}</h1>
          <p className="hero__lead" style={{ marginBottom: "var(--space-4)" }}>{c.description}</p>
          <dl className="dl">
            <dt>Usual minimum education</dt>
            <dd>{LEVEL_LABELS[c.min_education_level] || c.min_education_level}</dd>
            {c.work_style.length > 0 && (<><dt>Work setting</dt><dd>{c.work_style.map(pretty).join(", ")}</dd></>)}
            {c.key_aptitudes.length > 0 && (<><dt>Useful strengths</dt><dd>{c.key_aptitudes.map(pretty).join(", ")}</dd></>)}
          </dl>
          <div className="btn-row" style={{ marginTop: "var(--space-4)" }}>
            <Link to={`/skill-gap?career=${c.career_id}`} className="btn btn--secondary btn--small">Check my skill gap</Link>
            <Link to={`/roadmap?career=${c.career_id}`} className="btn btn--secondary btn--small">Get a roadmap</Link>
          </div>
        </header>

        <div className="detail-grid">
          <Section title="Skills you need">
            {mandatory.length > 0 && (
              <>
                <h3 className="detail-sub">Core skills</h3>
                <ul className="skill-list">
                  {mandatory.map((s) => (
                    <li key={s.skill_id}>
                      <span>{s.name}</span>
                      <span className="muted small">{pretty(s.proficiency_required)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {helpful.length > 0 && (
              <>
                <h3 className="detail-sub">Also helpful</h3>
                <ul className="tag-list">
                  {helpful.map((s) => <li key={s.skill_id} className="badge">{s.name}</li>)}
                </ul>
              </>
            )}
          </Section>

          <Section title="How people get here">
            {c.entry_paths.length === 0 && <p className="muted">Usually reached from another career (see below).</p>}
            <ul className="path-list">
              {c.entry_paths.map((p) => (
                <li key={p.path_id}>
                  <strong>From {p.from_stage_name}</strong>
                  <p className="small" style={{ margin: "var(--space-1) 0" }}>{p.eligibility_summary}</p>
                  {p.required_exams.length > 0 && (
                    <p className="small" style={{ margin: 0 }}>
                      Exams:{" "}
                      {p.required_exams.map((e, i) => (
                        <span key={e.exam_id}>
                          {i > 0 && ", "}
                          <a href={e.official_url} target="_blank" rel="noopener noreferrer">
                            {e.name}<span className="visually-hidden"> (official site, opens in new tab)</span>
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                  {(p.advantages || p.limitations) && (
                    <p className="muted small" style={{ margin: "var(--space-1) 0 0" }}>
                      {p.advantages && <>+ {p.advantages}</>}
                      {p.advantages && p.limitations && <br />}
                      {p.limitations && <>− {p.limitations}</>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Where it can lead">
            <CareerLinks items={c.next_careers} empty="No common next moves recorded yet." />
          </Section>

          <Section title="Roles that often lead here">
            <CareerLinks items={c.previous_careers} empty="No common previous roles recorded yet." />
          </Section>
        </div>

        {c.transitions_in.length > 0 && (
          <section className="detail-block">
            <h2>Switching into this career</h2>
            <div className="grid">
              {c.transitions_in.map((t) => (
                <article key={t.transition_id} className="card">
                  <h3>From {t.from_name}</h3>
                  <p className="muted small">
                    Difficulty: {pretty(t.difficulty)}
                    {t.estimated_months_min != null && ` · about ${t.estimated_months_min}–${t.estimated_months_max} months`}
                  </p>
                  <ol className="plain-list small">
                    {t.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  {t.notes && <p className="muted small" style={{ marginTop: "var(--space-3)" }}>{t.notes}</p>}
                </article>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: "var(--space-3)" }}>Time estimates are general guidance for part-time study, not guarantees.</p>
          </section>
        )}

        {c.riasec_codes.length > 0 && (
          <p className="muted small">
            Interest types that fit: {c.riasec_codes.map((code) => RIASEC[code] || code).join(", ")}.
          </p>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-5)" }}>
          Source:{" "}
          <a href={c.source_url} target="_blank" rel="noopener noreferrer">
            {new URL(c.source_url).hostname}<span className="visually-hidden"> (opens in new tab)</span>
          </a>
          {" "}· last checked {c.last_verified}. Exam and eligibility details change every year; always confirm on the
          official website before applying.
        </p>
      </div>
    </section>
  );
}
