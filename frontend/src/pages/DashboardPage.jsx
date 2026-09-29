import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { NAV_GROUPS } from "../navigation";
import * as api from "../services/api";

// The guided steps, in order. Each one reads its own "done" state from the
// loaded data. The FIRST unfinished step becomes "Do this next".
const JOURNEY = [
  {
    id: "profile",
    icon: "user",
    title: "Build your profile",
    blurb: "Tell us your education, skills, interests and goals so every suggestion fits you.",
    cta: "Complete profile",
    to: "/profile/edit",
    done: (d) => d.hasProfile,
  },
  {
    id: "assessments",
    icon: "clipboard",
    title: "Take a short assessment",
    blurb: "Interest, aptitude and personality tests sharpen your matches. Even one helps.",
    cta: "Start an assessment",
    to: "/assessments",
    done: (d) => d.assessmentsDone > 0,
  },
  {
    id: "recommendations",
    icon: "star",
    title: "See careers that fit you",
    blurb: "Ranked matches with the reason behind every score. Pick one as your target.",
    cta: "View my matches",
    to: "/for-you",
    done: (d) => d.hasTarget,
  },
  {
    id: "roadmap",
    icon: "map",
    title: "Follow your roadmap",
    blurb: "A stage-by-stage plan to your target that skips what you already know.",
    cta: "Open my roadmap",
    to: "/roadmap",
    done: (d) => d.hasTarget && (d.skillsTicked > 0 || d.roadmapPercent === 100),
  },
];

// Shortcuts to the other features (everything except the journey pages above)
const SHORTCUTS = NAV_GROUPS.slice(1).flatMap((group) => group.items);

function describe(step, data) {
  if (step.id === "assessments") return `${data.assessmentsDone} of ${data.assessmentsTotal} taken. ${step.blurb}`;
  if (step.id === "roadmap" && data.targetName) return `Target: ${data.targetName}. ${step.blurb}`;
  return step.blurb;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

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
          assessmentsDone: items.filter((t) => t.completed_at).length,
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
          <h1>Could not load your dashboard</h1>
          <p className="muted">{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setError("");
            setData(null);
            setAttempt((n) => n + 1);
          }}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="page-center" role="status" aria-label="Loading your dashboard">
        <div className="loader" />
      </div>
    );
  }

  const doneCount = JOURNEY.filter((step) => step.done(data)).length;
  const nextStep = JOURNEY.find((step) => !step.done(data));
  const percent = Math.round((doneCount / JOURNEY.length) * 100);

  return (
    <section className="page">
      <div className="container">
        {location.state?.profileJustSaved && (
          <div className="notice" role="status" style={{ marginBottom: "var(--space-5)" }}>
            Profile saved. Here's what to do next.
          </div>
        )}

        <div className="page__head">
          <div>
            <h1>{data.name ? `Welcome, ${data.name}` : "Welcome"}</h1>
            <p className="muted">Your guided path. Follow the steps in order, or jump to anything on the right.</p>
          </div>
        </div>

        {/* The single recommended next action */}
        <div className="dash-next" role="region" aria-label="Recommended next step">
          {nextStep ? (
            <>
              <p className="dash-next__label">Do this next</p>
              <h2 className="dash-next__title">{nextStep.title}</h2>
              <p className="muted">{nextStep.blurb}</p>
              <div className="btn-row">
                <Link to={nextStep.to} className="btn btn--primary">
                  {nextStep.cta}
                  <Icon name="arrow" size={18} className="icon icon-arrow" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="dash-next__label">All steps done</p>
              <h2 className="dash-next__title">You're on your way</h2>
              <p className="muted">
                Keep ticking skills on your roadmap, check a dream career, or ask the mentor anything about your plan.
              </p>
              <div className="btn-row">
                <Link to="/roadmap" className="btn btn--primary">
                  Open my roadmap
                </Link>
                <Link to="/mentor" className="btn btn--secondary">
                  Ask the mentor
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="dash-grid" style={{ marginTop: "var(--space-6)" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>Your progress</h2>
            <div className="dash-progress">
              <div
                className="progress"
                role="progressbar"
                aria-label="Journey progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="progress__bar" style={{ width: `${percent}%` }} />
              </div>
              <strong>
                {doneCount} of {JOURNEY.length} steps done
              </strong>
            </div>
            <ol className="dash-steps">
              {JOURNEY.map((step, i) => {
                const done = step.done(data);
                const isNext = step === nextStep;
                return (
                  <li key={step.id} className={isNext ? "dash-step dash-step--next" : "dash-step"}>
                    <span
                      className={done ? "dash-step__mark dash-step__mark--done" : "dash-step__mark"}
                      aria-label={done ? "Done" : isNext ? "Next" : "Not started"}
                      role="img"
                    >
                      {done ? <Icon name="check" size={18} strokeWidth={2.4} /> : i + 1}
                    </span>
                    <div className="dash-step__body">
                      <h3 className="dash-step__title">{step.title}</h3>
                      <p className="muted">{describe(step, data)}</p>
                    </div>
                    <Link
                      to={step.to}
                      className={isNext ? "btn btn--primary btn--small dash-step__action" : "btn btn--secondary btn--small dash-step__action"}
                    >
                      {done ? "Review" : step.cta}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className="dash-side" aria-labelledby="more-title">
            <h2 id="more-title">Explore and prepare</h2>
            {SHORTCUTS.map((item) => (
              <Link key={item.path} to={item.path} className="stage-card">
                <span className="icon-tile">
                  <Icon name={item.icon} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <span className="muted">{item.text}</span>
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
