import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import * as api from "../services/api";

// Labels: detail.level.*, detail.riasec.*, detail.type.* in i18n/*.js
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
  const { t, tOr } = useI18n();
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="plain-list">
      {items.map((c) => (
        <li key={`${c.career_id}-${c.transition_type}`}>
          <Link to={`/careers/${c.career_id}`}>{c.name}</Link>
          <span className="muted">
            {" "}· {tOr(`detail.type.${c.transition_type}`, c.transition_type)}
            {c.typical_years_experience ? ` · ${t("detail.yrs", { n: c.typical_years_experience })}` : ""}
          </span>
          {c.notes && <div className="muted small">{c.notes}</div>}
        </li>
      ))}
    </ul>
  );
}

export default function CareerDetailPage() {
  const { careerId } = useParams();
  const { t, tOr } = useI18n();
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
      <div className="page-center" role="status" aria-label={t("detail.loading")}>
        <div className="loader" />
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <span className="badge">404</span>
          <h1 style={{ marginTop: "var(--space-4)" }}>{t("detail.notFound")}</h1>
          <p className="muted">{t("detail.notFound.text")}</p>
          <Link to="/careers" className="btn btn--primary">{t("detail.browseAll")}</Link>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>{t("detail.loadError")}</h1>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}>
            {t("common.tryAgain")}
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
        <nav aria-label={t("common.breadcrumb")} className="breadcrumb">
          <Link to="/careers">{t("nav.careers")}</Link> <span aria-hidden="true">/</span> <span>{c.name}</span>
        </nav>

        <header className="detail-head">
          <span className="badge">{tOr(`domain.${c.domain}`, c.domain)}{c.sub_domain ? ` · ${c.sub_domain}` : ""}</span>
          <h1>{c.name}</h1>
          <p className="hero__lead" style={{ marginBottom: "var(--space-4)" }}>{c.description}</p>
          <dl className="dl">
            <dt>{t("detail.minEducation")}</dt>
            <dd>{tOr(`detail.level.${c.min_education_level}`, c.min_education_level)}</dd>
            {c.work_style.length > 0 && (<><dt>{t("detail.workSetting")}</dt><dd>{c.work_style.map((w) => tOr(`detail.ws.${w}`, pretty(w))).join(", ")}</dd></>)}
            {c.key_aptitudes.length > 0 && (<><dt>{t("detail.strengths")}</dt><dd>{c.key_aptitudes.map((a) => tOr(`detail.apt.${a}`, pretty(a))).join(", ")}</dd></>)}
          </dl>
          <div className="btn-row" style={{ marginTop: "var(--space-4)" }}>
            <Link to={`/skill-gap?career=${c.career_id}`} className="btn btn--secondary btn--small">{t("detail.checkGap")}</Link>
            <Link to={`/roadmap?career=${c.career_id}`} className="btn btn--secondary btn--small">{t("detail.getRoadmap")}</Link>
            <Link to={`/compare?ids=${c.career_id}`} className="btn btn--secondary btn--small">{t("detail.compare")}</Link>
          </div>
        </header>

        <div className="detail-grid">
          <Section title={t("detail.skillsNeed")}>
            {mandatory.length > 0 && (
              <>
                <h3 className="detail-sub">{t("detail.coreSkills")}</h3>
                <ul className="skill-list">
                  {mandatory.map((s) => (
                    <li key={s.skill_id}>
                      <span>{s.name}</span>
                      <span className="muted small">{tOr(`opt.skill_levels.${s.proficiency_required}`, pretty(s.proficiency_required))}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {helpful.length > 0 && (
              <>
                <h3 className="detail-sub">{t("detail.alsoHelpful")}</h3>
                <ul className="tag-list">
                  {helpful.map((s) => <li key={s.skill_id} className="badge">{s.name}</li>)}
                </ul>
              </>
            )}
          </Section>

          <Section title={t("detail.howGetHere")}>
            {c.entry_paths.length === 0 && <p className="muted">{t("detail.fromAnother")}</p>}
            <ul className="path-list">
              {c.entry_paths.map((p) => (
                <li key={p.path_id}>
                  <strong>{t("detail.from", { name: p.from_stage_name })}</strong>
                  <p className="small" style={{ margin: "var(--space-1) 0" }}>{p.eligibility_summary}</p>
                  {p.required_exams.length > 0 && (
                    <p className="small" style={{ margin: 0 }}>
                      {t("dream.exams")}{" "}
                      {p.required_exams.map((e, i) => (
                        <span key={e.exam_id}>
                          {i > 0 && ", "}
                          <a href={e.official_url} target="_blank" rel="noopener noreferrer">
                            {e.name}<span className="visually-hidden"> {t("common.officialNewTab")}</span>
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

          <Section title={t("detail.leadsTo")}>
            <CareerLinks items={c.next_careers} empty={t("detail.noNext")} />
          </Section>

          <Section title={t("detail.prevRoles")}>
            <CareerLinks items={c.previous_careers} empty={t("detail.noPrev")} />
          </Section>
        </div>

        {c.transitions_in.length > 0 && (
          <section className="detail-block">
            <h2>{t("detail.switchInto")}</h2>
            <div className="grid">
              {c.transitions_in.map((tr) => (
                <article key={tr.transition_id} className="card">
                  <h3>{t("detail.from", { name: tr.from_name })}</h3>
                  <p className="muted small">
                    {t("detail.difficulty", { level: tOr(`detail.diff.${tr.difficulty}`, pretty(tr.difficulty)) })}
                    {tr.estimated_months_min != null && ` · ${t("detail.aboutMonths", { min: tr.estimated_months_min, max: tr.estimated_months_max })}`}
                  </p>
                  <ol className="plain-list small">
                    {tr.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  {tr.notes && <p className="muted small" style={{ marginTop: "var(--space-3)" }}>{tr.notes}</p>}
                </article>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: "var(--space-3)" }}>{t("detail.timeNote")}</p>
          </section>
        )}

        {c.riasec_codes.length > 0 && (
          <p className="muted small">
            {t("detail.riasecFit", { list: c.riasec_codes.map((code) => tOr(`detail.riasec.${code}`, code)).join(", ") })}
          </p>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-5)" }}>
          {t("common.source")}:{" "}
          <a href={c.source_url} target="_blank" rel="noopener noreferrer">
            {new URL(c.source_url).hostname}<span className="visually-hidden"> {t("common.newTab")}</span>
          </a>
          {" "}· {t("detail.lastChecked", { date: c.last_verified })}
        </p>
      </div>
    </section>
  );
}
