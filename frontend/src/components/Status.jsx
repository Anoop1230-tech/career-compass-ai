// Shared loading and error blocks, so every page looks and behaves the same.
import { useI18n } from "../i18n";

export function Loading({ label, minHeight = 200 }) {
  const { t } = useI18n();
  return (
    <div className="page-center" style={{ minHeight }} role="status" aria-label={label || t("common.loading")}>
      <div className="loader" />
    </div>
  );
}

export function ErrorNotice({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="notice notice--danger" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          {t("common.tryAgain")}
        </button>
      )}
    </div>
  );
}

/** Link to an official website that opens in a new tab, announced to screen readers. */
export function OfficialLink({ href, children }) {
  const { t } = useI18n();
  if (!href) return children ?? null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> {t("common.officialNewTab")}</span>
    </a>
  );
}

/** Small "not yet verified" marker for data taken from official sites but not re-checked. */
export function VerifiedBadge({ verified, date }) {
  const { t } = useI18n();
  return verified ? (
    <span className="badge badge--ok" title={date ? t("common.verifiedOn", { date }) : undefined}>{t("common.verified")}</span>
  ) : (
    <span className="badge badge--warn" title={t("common.notVerified.title")}>
      {t("common.notVerified")}
    </span>
  );
}

export function Meter({ value, label }) {
  const { t } = useI18n();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone = pct < 40 ? " meter__bar--low" : pct <= 60 ? " meter__bar--moderate" : "";
  return (
    <div className="meter" role="img" aria-label={t("common.outOf100", { label, n: pct })}>
      <div className={`meter__bar${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
