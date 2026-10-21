import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ErrorNotice, Loading, Meter } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

const RIASEC = ["R", "I", "A", "S", "E", "C"];
const PLAN_PERIODS = ["month", "quarter", "year"];

function Section({ title, children }) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function weeksText(t, weeks) {
  if (!weeks) return null;
  if (weeks >= 52) return t("road.aboutYears", { n: Math.round((weeks / 52) * 10) / 10 });
  return weeks === 1 ? t("gap.oneWeek") : t("gap.weeks", { n: weeks });
}

/** Name, a bar and the number, so the scores can be compared at a glance (and still read in print). */
function Scores({ scores, order }) {
  const { t, tOr } = useI18n();
  const keys = order ? order.filter((k) => k in scores) : Object.keys(scores);
  return (
    <ul className="report-scores">
      {keys.map((k) => {
        const label = tOr(`assess.scale.${k}`, k);
        return (
          <li key={k}>
            <span className="report-scores__label">{label}</span>
            <Meter value={scores[k]} label={label} />
            <strong>{t("report.outOf100", { n: scores[k] })}</strong>
          </li>
        );
      })}
    </ul>
  );
}

function Summary({ s }) {
  const { t } = useI18n();
  const rows = [
    s.best_match && [t("report.sum.bestMatch"), `${s.best_match.name} · ${Math.round(s.best_match.score)}/100`],
    s.target && [t("report.sum.target"), s.target],
    s.skills_ready && [t("report.sum.skills"), t("report.sum.skillsValue", s.skills_ready)],
    s.main_gap && [t("report.sum.mainGap"), s.main_gap],
    s.next_step && [t("report.sum.nextStep"), s.next_step],
  ].filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <section className="report-summary" aria-labelledby="report-summary-title">
      <h2 id="report-summary-title">{t("report.sum.title")}</h2>
      <dl>
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  );
}

function planItem(t, item) {
  const list = (names, more) => names.join(", ") + (more ? ` ${t("report.more", { n: more })}` : "");
  switch (item.kind) {
    case "action": return item.text;
    case "learn": return t("report.plan.learn", { list: list(item.skills, item.more) });
    case "continue": return t("report.plan.continue", { list: item.skills.join(", ") });
    case "project": return t("report.plan.project", { name: item.title });
    case "exam": return t("report.plan.exam", { list: item.exams.join(", ") });
    case "study": return t("report.plan.study", { name: item.title });
    case "apply": return t("report.plan.apply", { name: item.career });
    default: return null;
  }
}

/**
 * One printable page: summary, profile, test results, top matches, next steps, skill gap,
 * action plan and the roadmap. "Print / Save as PDF" uses the browser's own print dialog,
 * so no PDF library is needed.
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
  const gap = r.skill_gap;
  const plan = r.action_plan;
  const interest = r.tests.interest;

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

        {r.summary && <Summary s={r.summary} />}

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
                {interest && (
                  <div>
                    <h3>{t("report.interestTest")}</h3>
                    <p className="small">{t("report.topCodes", { list: interest.top_codes.map((c) => t(`assess.scale.${c}`)).join("; ") })}</p>
                    {Object.keys(interest.scores || {}).length > 0 && <Scores scores={interest.scores} order={RIASEC} />}
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
                  <div className="report-match__head">
                    <span><strong>{m.name}</strong> <span className="muted small">· {tOr(`domain.${m.domain}`, m.domain)}</span></span>
                    <span className="badge">{Math.round(m.score)}/100</span>
                  </div>
                  <Meter value={m.score} label={m.name} />
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
                  {s.reasons?.length > 0 && <div className="small">{t("next.fitsBecause")} {s.reasons.join("; ")}.</div>}
                  {s.next_action && <div className="small">{t("next.nextAction")} {s.next_action}</div>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {gap && gap.total > 0 && (
          <Section title={t("report.gap.title", { name: gap.career.name })}>
            <div className="report-gap__head">
              <span>{t("report.gap.have", { have: gap.have, total: gap.total })}</span>
              {gap.core_total > 0 && <span className="muted small">{t("report.gap.core", { have: gap.core_ready, total: gap.core_total })}</span>}
            </div>
            <Meter value={(gap.have / gap.total) * 100} label={t("report.gap.have", { have: gap.have, total: gap.total })} />
            {!gap.has_skills && <p className="small muted">{t("report.gap.noSkills")}</p>}
            {gap.missing.length > 0 ? (
              <>
                <h3>{t("report.gap.learn")}</h3>
                <ol className="report-gap">
                  {gap.missing.map((m) => (
                    <li key={m.skill_id}>
                      <strong>{m.name}</strong>{m.is_mandatory && <span className="badge">{t("report.gap.coreTag")}</span>}
                      <span className="small muted">
                        {" "}– {m.current_level === "none"
                          ? t("report.gap.toLevel", { level: tOr(`gap.level.${m.required_level}`, m.required_level) })
                          : t("report.gap.fromTo", { from: tOr(`gap.level.${m.current_level}`, m.current_level), to: tOr(`gap.level.${m.required_level}`, m.required_level) })}
                        {m.weeks > 0 && ` · ${weeksText(t, m.weeks)}`}
                      </span>
                    </li>
                  ))}
                </ol>
                {gap.more_missing > 0 && <p className="small muted">{t("report.more", { n: gap.more_missing })}</p>}
              </>
            ) : (
              <p className="small">{t("report.gap.allDone")}</p>
            )}
          </Section>
        )}

        {plan && PLAN_PERIODS.some((p) => plan[p]?.length) && (
          <Section title={t("report.plan.title")}>
            <div className="report-plan">
              {PLAN_PERIODS.filter((p) => plan[p]?.length).map((p) => (
                <div key={p} className="report-plan__col">
                  <h3>{t(`report.plan.${p}`)}</h3>
                  <ul>
                    {plan[p].map((item, i) => <li key={i}>{planItem(t, item)}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="small muted">{t("report.plan.note")}</p>
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
                  {s.weeks > 0 && <span className="badge report-roadmap__weeks">{weeksText(t, s.weeks)}</span>}
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
