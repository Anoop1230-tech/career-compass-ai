import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ComingUp from "../components/ComingUp";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { NAV_GROUPS, navLabel, navText } from "../navigation";
import * as api from "../services/api";

// The guided steps, in order. Each one reads its own "done" state from the
// loaded data. The FIRST unfinished step becomes "Do this next".
// Texts: dash.step.<id>.title / .blurb / .cta in i18n/*.js
const JOURNEY = [
  { id: "profile", icon: "user", to: "/profile/quick", done: (d) => d.hasProfile },
  { id: "assessments", icon: "clipboard", to: "/assessments", done: (d) => d.assessmentsDone > 0 },
  { id: "recommendations", icon: "star", to: "/for-you", done: (d) => d.hasTarget },
  {
    id: "roadmap",
    icon: "map",
    to: "/roadmap",
    done: (d) => d.hasTarget && (d.skillsTicked > 0 || d.roadmapPercent === 100),
  },
];

// Shortcuts to the other features (everything except the journey pages above)
const SHORTCUTS = NAV_GROUPS.slice(1).flatMap((group) => group.items);

function describe(t, step, data) {
  const blurb = t(`dash.step.${step.id}.blurb`);
  if (step.id === "assessments") {
    return `${t("dash.testsTaken", { done: data.assessmentsDone, total: data.assessmentsTotal })} ${blurb}`;
  }
  if (step.id === "roadmap" && data.targetName) return `${t("dash.target", { name: data.targetName })} ${blurb}`;
  return blurb;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reminders, setReminders] = useState(null);

  // Optional extra: a failure here hides the section instead of breaking the dashboard
  useEffect(() => {
    let active = true;
    api.getReminders().then((r) => active && setReminders(r)).catch(() => active && setReminders(null));
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    // "No profile", "no assessments" and "no target" are normal not-done-yet
    // states (404 / empty), not errors. Only real failures show the error screen.
    const notFoundAs = (value) => (err) => {
      if (api.isNotFound(err)) return value;
      throw err;
    };
    Promise.all([
      api.getProfile().catch(notFoundAs(null)),
      api.getAssessments(),
      api.getMyRoadmap().catch(notFoundAs(null)),
    ])
      .then(([profile, tests, roadmap]) => {
        if (!active) return;
        const items = Array.isArray(tests) ? tests : [];
        const done = roadmap?.progress?.done || 0;
        setData({
          name: profile?.full_name?.split(" ")[0] || "",
          hasProfile: Boolean(profile),
          assessmentsDone: items.filter((x) => x.completed_at).length,
          assessmentsTotal: items.length || 3,
          hasTarget: Boolean(roadmap),
          targetName: roadmap?.career?.name || "",
          skillsTicked: done,
          roadmapPercent: roadmap?.progress?.percent ?? 0,
        });
      })
      .catch((err) => active && setError(api.getErrorMessage(err)));

    return () => {
      active = false;
    };
  }, [user?.id, attempt]);

  if (error) {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>{t("dash.loadError")}</h1>
          <p className="muted">{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setError("");
            setData(null);
            setAttempt((n) => n + 1);
          }}>
            {t("common.tryAgain")}
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="page-center" role="status" aria-label={t("dash.loading")}>
        <div className="loader" />
      </div>
    );
  }

  const doneCount = JOURNEY.filter((step) => step.done(data)).length;
  const nextStep = JOURNEY.find((step) => !step.done(data));
  const percent = Math.round((doneCount / JOURNEY.length) * 100);
  const stepText = (step, part) => t(`dash.step.${step.id}.${part}`);

  return (
    <section className="page">
      <div className="container">
        {location.state?.profileJustSaved && (
          <div className="notice" role="status" style={{ marginBottom: "var(--space-5)" }}>
            {t("dash.profileSaved")}
          </div>
        )}

        <div className="page__head">
          <div>
            <h1>{data.name ? t("dash.welcomeName", { name: data.name }) : t("dash.welcome")}</h1>
            <p className="muted">{t("dash.lead")}</p>
          </div>
        </div>

        {/* The single recommended next action */}
        <div className="dash-next" role="region" aria-label={t("dash.nextRegion")}>
          {nextStep ? (
            <>
              <p className="dash-next__label">{t("dash.doNext")}</p>
              <h2 className="dash-next__title">{stepText(nextStep, "title")}</h2>
              <p className="muted">{stepText(nextStep, "blurb")}</p>
              <div className="btn-row">
                <Link to={nextStep.to} className="btn btn--primary">
                  {stepText(nextStep, "cta")}
                  <Icon name="arrow" size={18} className="icon icon-arrow" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="dash-next__label">{t("dash.allDone")}</p>
              <h2 className="dash-next__title">{t("dash.onYourWay")}</h2>
              <p className="muted">{t("dash.onYourWay.text")}</p>
              <div className="btn-row">
                <Link to="/roadmap" className="btn btn--primary">{t("dash.step.roadmap.cta")}</Link>
                <Link to="/mentor" className="btn btn--secondary">{t("dash.askMentor")}</Link>
              </div>
            </>
          )}
        </div>

        <ComingUp data={reminders} onChange={setReminders} />

        <div className="dash-grid" style={{ marginTop: "var(--space-6)" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>{t("dash.progress")}</h2>
            <div className="dash-progress">
              <div
                className="progress"
                role="progressbar"
                aria-label={t("dash.progressLabel")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="progress__bar" style={{ width: `${percent}%` }} />
              </div>
              <strong>{t("dash.stepsDone", { done: doneCount, total: JOURNEY.length })}</strong>
            </div>
            <ol className="dash-steps">
              {JOURNEY.map((step, i) => {
                const done = step.done(data);
                const isNext = step === nextStep;
                return (
                  <li key={step.id} className={isNext ? "dash-step dash-step--next" : "dash-step"}>
                    <span
                      className={done ? "dash-step__mark dash-step__mark--done" : "dash-step__mark"}
                      aria-label={done ? t("dash.mark.done") : isNext ? t("dash.mark.next") : t("dash.mark.notStarted")}
                      role="img"
                    >
                      {done ? <Icon name="check" size={18} strokeWidth={2.4} /> : i + 1}
                    </span>
                    <div className="dash-step__body">
                      <h3 className="dash-step__title">{stepText(step, "title")}</h3>
                      <p className="muted">{describe(t, step, data)}</p>
                    </div>
                    <Link
                      to={step.to}
                      className={isNext ? "btn btn--primary btn--small dash-step__action" : "btn btn--secondary btn--small dash-step__action"}
                    >
                      {done ? t("dash.review") : stepText(step, "cta")}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className="dash-side" aria-labelledby="more-title">
            <h2 id="more-title">{t("dash.more")}</h2>
            {SHORTCUTS.map((item) => (
              <Link key={item.path} to={item.path} className="stage-card">
                <span className="icon-tile">
                  <Icon name={item.icon} />
                </span>
                <span>
                  <strong>{navLabel(t, item)}</strong>
                  <span className="muted">{navText(t, item)}</span>
                </span>
                <Icon name="arrow" size={18} className="icon stage-card__go" />
              </Link>
            ))}
          </aside>
        </div>
      </div>
    </section>
  );
}
