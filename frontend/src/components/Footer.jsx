import { useHealth } from "../hooks/useHealth";

const LABELS = {
  checking: "Checking server…",
  online: "Server online",
  offline: "Server offline",
};

export default function Footer() {
  const { status, error, retry } = useHealth();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>© {new Date().getFullYear()} Career Compass AI · Guidance, not guarantees.</span>

        <span className={`status status--${status}`} role="status" aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          <span title={error || undefined}>{LABELS[status]}</span>
          {status === "offline" && (
            <button type="button" className="btn btn--secondary btn--small" onClick={retry}>
              Retry
            </button>
          )}
        </span>
      </div>
    </footer>
  );
}
