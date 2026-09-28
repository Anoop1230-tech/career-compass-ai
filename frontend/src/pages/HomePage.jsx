import { Link } from "react-router-dom";

const STAGES = [
  { label: "Class 10", hint: "Choose a stream" },
  { label: "Class 11–12", hint: "Courses and entrance exams" },
  { label: "Diploma", hint: "Lateral entry or jobs" },
  { label: "Undergraduate", hint: "Specialize, intern, prepare" },
  { label: "Graduate", hint: "Job, higher studies or exams" },
  { label: "Master's / PhD", hint: "Research, industry, teaching" },
  { label: "Working professional", hint: "Grow or upskill" },
  { label: "Career changer", hint: "Switch to a new field" },
];

const FEATURES = [
  { title: "Next steps", text: "Realistic paths from your current stage, with eligibility, time and exams.", to: "/next-steps" },
  { title: "Career explorer", text: "See every direction your education can lead to, as a clear tree.", to: "/explore" },
  { title: "Skill gap and roadmap", text: "Compare your skills with a target career and get a stage-wise plan.", to: "/roadmap" },
  { title: "Exams, colleges, scholarships", text: "Filtered lists linked to official sources.", to: "/resources" },
  { title: "Assessments", text: "Interest, aptitude and personality tests that sharpen your results.", to: "/assessments" },
  { title: "Career mentor", text: "Ask questions and get answers based on your own profile.", to: "/mentor" },
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="hero__eyebrow">Career guidance for every stage</p>
          <h1>Where are you now, and where do you want to go?</h1>
          <p className="hero__lead">
            Career Compass looks at your education, skills, interests and goals, then maps realistic next
            steps. Every suggestion explains why, and shows what to learn next.
          </p>
          <div className="btn-row">
            <Link to="/next-steps" className="btn btn--primary">
              Find my next step
            </Link>
            <Link to="/explore" className="btn btn--secondary">
              Explore careers
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="stages-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="stages-title">Start from where you are</h2>
            <p className="muted">School, college or work. Pick the stage closest to you.</p>
          </div>
          <ul className="grid grid--compact" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STAGES.map((stage) => (
              <li key={stage.label}>
                <Link to="/next-steps" className="card card--link">
                  <h3>{stage.label}</h3>
                  <p className="muted">{stage.hint}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="features-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="features-title">What you can do</h2>
          </div>
          <div className="grid">
            {FEATURES.map((feature) => (
              <Link key={feature.title} to={feature.to} className="card card--link">
                <h3>{feature.title}</h3>
                <p className="muted">{feature.text}</p>
                <span className="card__arrow">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="how-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="how-title">How it works</h2>
          </div>
          <ol className="steps">
            <li>
              <h3>Build your profile</h3>
              <p className="muted">Education, skills, experience, interests and goals.</p>
            </li>
            <li>
              <h3>Take short assessments</h3>
              <p className="muted">Optional tests that make results more personal.</p>
            </li>
            <li>
              <h3>Compare paths</h3>
              <p className="muted">Ranked options with the reasons behind each one.</p>
            </li>
            <li>
              <h3>Follow your roadmap</h3>
              <p className="muted">Clear stages, skipping what you already know.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="notice">
            Recommendations are guidance based on the information you give, not guaranteed outcomes. Always
            confirm eligibility and dates on the official website before applying.
          </p>
        </div>
      </section>
    </>
  );
}
