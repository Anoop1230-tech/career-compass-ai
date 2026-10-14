import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ErrorNotice, Loading } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

function Section({ title, children }) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Scores({ scores }) {
  const { t, tOr } = useI18n();
  return (
    <ul className="report-scores">
      {Object.entries(scores).map(([k, v]) => (
        <li key={k}><span>{tOr(`assess.scale.${k}`, k)}</span> <strong>{t("report.outOf100", { n: v })}</strong></li>
      ))}
    </ul>
  );
}

/**
 * One printable page: profile, test results, top matches, next steps and the roadmap.
 * "Print / Save as PDF" uses the browser's own print dialog, so no PDF library is needed.
 */
export default function ReportPage() {
  const { t, tOr, lang } = useI18n();
  const report = useRequest((signal) => api.getReport(signal), []);
  const r = report.data;

  useEffect(() => {
    // The file name browsers suggest when saving as PDF comes from the title
    if (r) document.title = `${t("report.title")} – ${r.profile?.name || r.email} – Career Compass AI`;
    return () => { document.title = "Career Compass AI"; };
  }, [r, t]);

  if (report.status === "loading") return <Loading label={t("report.loading")} />;
  if (report.status === "error") {
    return <section className="page"><div className="container"><ErrorNotice message={report.error} onRetry={report.reload} /></div></section>;
  }

  const date = new Date(`${r.generated_on}T00:00:00`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN",
    { day: "numeric", month: "long", year: "numeric" });
  const road = r.roadmap;

  return (
    <section className="page report-page">
      <div className="container report">
        <div className="page__head report__head">
          <div>
            <p className="report__brand">Career Compass AI</p>
            <h1>{t("report.title")}</h1>
            <p className="muted">{t("report.for", { name: r.profile?.name || r.email, date })}</p>
          </div>
          <div className="btn-row no-print">
            <button type="button" className="btn btn--primary" onClick={() => window.print()}>{t("report.print")}</button>
            <Link to="/dashboard" className="btn btn--secondary">{t("nav.dashboard")}</Link>
          </div>
        </div>
        <p className="notice small no-print">{t("report.printHint")}</p>

        {!r.profile && (
          <p className="notice">{t("report.noProfile")} <Link to="/profile/quick">{t("profile.create")}</Link></p>
        )}

        {r.profile && (
          <Section title={t("report.about")}>
            <dl className="dl report-dl">
              {r.profile.stage && (<><dt>{t("report.stage")}</dt><dd>{r.profile.stage}</dd></>)}
              {r.profile.education && (<><dt>{t("report.education")}</dt><dd>{r.profile.education}</dd></>)}
              {r.profile.skills.length > 0 && (<><dt>{t("report.skills")}</dt><dd>{r.profile.skills.join(", ")}</dd></>)}
              {r.profile.interests.length > 0 && (
                <><dt>{t("report.interests")}</dt><dd>{r.profile.interests.map((i) => tOr(`opt.interests.${i}`, i)).join(", ")}</dd></>)}
              {r.profile.goals.length > 0 && (
                <><dt>{t("report.goals")}</dt><dd>{r.profile.goals.map((g) => tOr(`opt.goals.${g}`, g)).join(", ")}</dd></>)}
            </dl>
          </Section>
        )}

        {r.profile && (
          <Section title={t("report.tests")}>
            {Object.keys(r.tests).length === 0 ? (
              <p className="muted">{t("report.noTests")} <Link to="/assessments" className="no-print">{t("nav.assessments")}</Link></p>
            ) : (
              <div className="report-grid">
                {r.tests.interest && (
                  <div>
                    <h3>{t("report.interestTest")}</h3>
                    <p className="small">{t("report.topCodes", { list: r.tests.interest.top_codes.map((c) => t(`assess.scale.${c}`)).join("; ") })}</p>
                  </div>
                )}
                {r.tests.aptitude && <div><h3>{t("report.aptitudeTest")}</h3><Scores scores={r.tests.aptitude} /></div>}
                {r.tests.personality && <div><h3>{t("report.personalityTest")}</h3><Scores scores={r.tests.personality} /></div>}
              </div>
            )}
          </Section>
        )}

        {r.matches.length > 0 && (
          <Section title={t("report.matches")}>
            {r.confidence && <p className="small muted">{t("rec.confidence", { n: r.confidence.percent })} · {t(`rec.level.${r.confidence.level}`)}</p>}
            <ol className="report-matches">
              {r.matches.map((m) => (
                <li key={m.career_id}>
                  <strong>{m.name}</strong> <span className="muted small">· {tOr(`domain.${m.domain}`, m.domain)}</span>{" "}
                  <span className="badge">{Math.round(m.score)}/100</span>
                  {m.strengths.length > 0 && <div className="small">{t("rec.whyFits")}: {m.strengths.join("; ")}</div>}
                  {m.concerns.length > 0 && <div className="small muted">{t("rec.keepInMind")}: {m.concerns.join("; ")}</div>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {r.next_steps.length > 0 && (
          <Section title={t("report.nextSteps")}>
            <ul className="plain-list">
              {r.next_steps.map((s) => (
                <li key={s.title}>
                  <strong>{s.title}</strong>
                  {s.next_action && <div className="small">{t("next.nextAction")} {s.next_action}</div>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {road && (
          <Section title={road.is_target ? t("report.roadmapTarget", { name: road.career.name }) : t("report.roadmapTop", { name: road.career.name })}>
            <p className="small muted">
              {t("report.roadmapProgress", { done: road.progress.done, total: road.progress.total })}
              {road.projects_progress?.total > 0 && ` · ${t("report.projectsProgress", { done: road.projects_progress.done, total: road.projects_progress.total })}`}
              {road.total_weeks > 0 && ` · ${t("report.weeksLeft", { n: road.total_weeks, h: road.hours_per_week })}`}
              {road.study_years > 0 && t("road.plusStudy", { n: road.study_years })}
            </p>
            <ol className="report-roadmap">
              {road.stages.map((s) => (
                <li key={s.key}>
                  <strong>{s.title}</strong>
                  {s.items.length > 0 && <span className="small"> – {s.items.join(", ")}</span>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        <p className="small muted report__foot">{t("report.disclaimer")}</p>
      </div>
    </section>
  );
}
