import { Link } from "react-router-dom";

/** Placeholder for features that are planned in a later phase. */
export default function ComingSoonPage({ title, description, phase }) {
  return (
    <section className="page-center">
      <div className="page-center__box">
        <span className="badge">Coming in phase {phase}</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>{title}</h1>
        <p className="muted">{description}</p>
        <div className="btn-row">
          <Link to="/" className="btn btn--secondary">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
