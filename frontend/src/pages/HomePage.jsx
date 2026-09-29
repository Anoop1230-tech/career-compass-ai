import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { NAV_GROUPS } from "../navigation";

const STAGES = [
  { label: "Class 10", hint: "Choose a stream", to: "/next-steps?stage=EDU_CLASS_10", icon: "book" },
  { label: "Class 11–12", hint: "Courses and entrance exams", to: "/next-steps?stage=EDU_12_PCM", icon: "clipboard" },
  { label: "Diploma", hint: "Lateral entry or jobs", to: "/next-steps?stage=EDU_DIPLOMA_CS", icon: "steps" },
  { label: "Undergraduate", hint: "Specialise, intern, prepare", to: "/next-steps?stage=EDU_BTECH_CSE", icon: "school" },
  { label: "Graduate", hint: "Job, higher studies or exams", to: "/next-steps?stage=EDU_BCA", icon: "briefcase" },
  { label: "Master's / PhD", hint: "Research, industry, teaching", to: "/next-steps?stage=EDU_MTECH_CSE", icon: "spark" },
  { label: "Working professional", hint: "Grow or upskill", to: "/next-steps?stage=EDU_WORKING_TECH", icon: "star" },
  { label: "Career changer", hint: "Switch to a new field", to: "/dream-check", icon: "target" },
];

// The four-step journey, shown in the hero preview and in "How it works"
const JOURNEY = [
  { icon: "user", title: "Build your profile", text: "Education, skills, interests and goals." },
  { icon: "clipboard", title: "Take short assessments", text: "Optional tests that sharpen your results." },
  { icon: "star", title: "Compare your matches", text: "Ranked careers with the reasons behind each." },
  { icon: "map", title: "Follow your roadmap", text: "Clear stages that skip what you already know." },
];

export default function HomePage() {
  const { status } = useAuth();
  const loggedIn = status === "authenticated";

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <p className="hero__eyebrow">
              <Icon name="compass" size={16} />
              Career guidance for every stage
            </p>
            <h1>
              Where are you now, and where do you <em>want to go?</em>
            </h1>
            <p className="hero__lead">
              Tell us about your education, skills and goals. Career Compass maps realistic next steps, explains
              every suggestion, and shows exactly what to learn next.
            </p>
            <div className="btn-row">
              <Link to="/next-steps" className="btn btn--primary">
                Find my next step
                <Icon name="arrow" size={18} className="icon icon-arrow" />
              </Link>
              {loggedIn ? (
                <Link to="/dashboard" className="btn btn--secondary">
                  Go to my dashboard
                </Link>
              ) : (
                <Link to="/register" className="btn btn--secondary">
                  Create a free profile
                </Link>
              )}
            </div>
            <ul className="hero__trust">
              <li>
                <Icon name="check" size={16} />
                Free to use
              </li>
              <li>
                <Icon name="check" size={16} />
                Explore without signing up
              </li>
              <li>
                <Icon name="check" size={16} />
                Links to official sources
              </li>
            </ul>
          </div>

          <aside className="journey" aria-label="Your journey in four steps">
            <div className="journey__head">
              <strong>Your journey</strong>
              <span className="badge">4 steps</span>
            </div>
            <ol className="journey__list">
              {JOURNEY.map((step, i) => (
                <li key={step.title} className={i === 0 ? "journey__item journey__item--active" : "journey__item"}>
                  <span className={i % 2 ? "icon-tile icon-tile--warm" : "icon-tile"}>
                    <Icon name={step.icon} />
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="stages-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="stages-title">Start from where you are</h2>
            <p className="muted">School, college or work. Pick the stage closest to you to see your options.</p>
          </div>
          <ul className="stage-grid">
            {STAGES.map((stage) => (
              <li key={stage.label}>
                <Link to={stage.to} className="stage-card">
                  <span className="icon-tile">
                    <Icon name={stage.icon} />
                  </span>
                  <span>
                    <strong>{stage.label}</strong>
                    <span className="muted">{stage.hint}</span>
                  </span>
                  <Icon name="arrow" size={18} className="icon stage-card__go" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="how-title">How it works</h2>
            <p className="muted">Four steps. Each one makes the next more personal, and you can stop at any time.</p>
          </div>
          <ol className="steps">
            {JOURNEY.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p className="muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="features-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="features-title">Everything in one place</h2>
            <p className="muted">Grouped the way you will use it: your own journey first, then explore, then prepare.</p>
          </div>
          <div className="feature-groups">
            {NAV_GROUPS.map((group, g) => (
              <article key={group.label} className="card feature-group">
                <div className="feature-group__head">
                  <h3>{group.label}</h3>
                  <p className="muted">{group.hint}</p>
                </div>
                <ul className="feature-list">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <Link to={item.path} className="feature-link">
                        <span className={g === 1 ? "icon-tile icon-tile--warm" : "icon-tile"}>
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <span className="muted">{item.text}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-title">
        <div className="container">
          <div className="cta-band">
            <div>
              <h2 id="cta-title">Ready to map your path?</h2>
              <p>It takes about five minutes to build a profile. Every page after that is tailored to you.</p>
            </div>
            <div className="btn-row">
              <Link to={loggedIn ? "/dashboard" : "/register"} className="btn btn--primary">
                {loggedIn ? "Open my dashboard" : "Get started free"}
              </Link>
              <Link to="/careers" className="btn btn--secondary">
                Browse careers
              </Link>
            </div>
          </div>
          <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
            Recommendations are guidance based on the information you give, not guaranteed outcomes. Always confirm
            eligibility and dates on the official website before applying.
          </p>
        </div>
      </section>
    </>
  );
}
