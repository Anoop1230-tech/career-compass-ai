// Shared loading and error blocks, so every page looks and behaves the same.
export function Loading({ label = "Loading", minHeight = 200 }) {
  return (
    <div className="page-center" style={{ minHeight }} role="status" aria-label={label}>
      <div className="loader" />
    </div>
  );
}

export function ErrorNotice({ message, onRetry }) {
  return (
    <div className="notice notice--danger" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Link to an official website that opens in a new tab, announced to screen readers. */
export function OfficialLink({ href, children }) {
  if (!href) return children ?? null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (official site, opens in new tab)</span>
    </a>
  );
}

/** Small "not yet verified" marker for data taken from official sites but not re-checked. */
export function VerifiedBadge({ verified, date }) {
  return verified ? (
    <span className="badge badge--ok" title={date ? `Verified on ${date}` : undefined}>Verified</span>
  ) : (
    <span className="badge badge--warn" title="Confirm on the official website before acting">
      Not yet verified
    </span>
  );
}

export function Meter({ value, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone = pct < 40 ? " meter__bar--low" : pct <= 60 ? " meter__bar--moderate" : "";
  return (
    <div className="meter" role="img" aria-label={`${label}: ${pct} out of 100`}>
      <div className={`meter__bar${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
