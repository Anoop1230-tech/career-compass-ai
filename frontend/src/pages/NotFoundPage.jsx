import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="page-center">
      <div className="page-center__box">
        <span className="badge">404</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>Page not found</h1>
        <p className="muted">The page you are looking for does not exist or has moved.</p>
        <div className="btn-row">
          <Link to="/" className="btn btn--primary">
            Go to home
          </Link>
        </div>
      </div>
    </section>
  );
}
