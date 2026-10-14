import { useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, OfficialLink } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

// Same set the Resources page uses, so the two filters stay consistent.
const LEVELS = ["government_job", "ug_admission", "pg_admission", "doctoral", "other"];
// Administrative reach of the exam / the post it recruits for.
const SCOPES = ["national", "state", "district", "local", "international"];
// How far ahead to look. "" means no limit (everything we know about).
const HORIZONS = ["30", "90", "180", "365", ""];

function monthKey(iso) {
  // "2026-11-10" -> "2026-11"
  return iso.slice(0, 7);
}

function formatDay(iso, lang) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonth(key, lang) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric" });
}

/** One exam event: what it is, when, and where to apply. */
function EventCard({ e }) {
  const { t, lang, tOr } = useI18n();
  const when = e.exact
    ? (e.start === e.end ? formatDay(e.start, lang) : `${formatDay(e.start, lang)} – ${formatDay(e.end, lang)}`)
    : t("upcoming.usuallyIn", { month: formatMonth(monthKey(e.start), lang) });
  return (
    <article className="card resource-card" aria-labelledby={`u-${e.key}`}>
      <div className="option-card__head">
        <h3 id={`u-${e.key}`} className="option-card__title">
          <OfficialLink href={e.source_url || e.official_url}>{e.exam_name}</OfficialLink>
        </h3>
        <span className="badge">{e.label}</span>
      </div>
      <p className="muted small">{e.conducting_body} · {tOr(`res.level.${e.exam_level}`, e.exam_level)}{e.exam_scope ? ` · ${tOr(`scope.${e.exam_scope}`, e.exam_scope)}` : ""}</p>
      <dl className="dl small">
        <dt>{t("upcoming.date")}</dt>
        <dd>
          {when}{" "}
          {e.exact
            ? <span className="badge badge--ok">{t("upcoming.confirmed")}</span>
            : <span className="badge badge--warn" title={t("upcoming.indicative.title")}>{t("upcoming.indicative")}</span>}
        </dd>
        {e.purpose && (<><dt>{t("upcoming.about")}</dt><dd>{e.purpose}</dd></>)}
      </dl>
      {e.can_apply && (
        <div className="option-card__foot small">
          <OfficialLink href={e.source_url || e.official_url}>{t("upcoming.apply")}</OfficialLink>
        </div>
      )}
    </article>
  );
}

export default function UpcomingExamsPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const level = LEVELS.includes(params.get("level")) ? params.get("level") : "";
  const scope = SCOPES.includes(params.get("scope")) ? params.get("scope") : "";
  const days = HORIZONS.includes(params.get("days")) ? params.get("days") : "180";

  const set = (updates) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const list = useRequest(
    (signal) => api.getUpcomingExams({ level, scope, days: days || undefined }, signal),
    [level, scope, days],
  );

  // Group the sorted events by calendar month for a Sarkari-Result-style timeline.
  const groups = [];
  if (list.status === "ready") {
    let current = null;
    for (const e of list.data.events) {
      const key = monthKey(e.start);
      if (!current || current.key !== key) {
        current = { key, items: [] };
        groups.push(current);
      }
      current.items.push(e);
    }
  }

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("upcoming.title")}</h1>
            <p className="muted">{t("upcoming.lead")}</p>
          </div>
        </div>

        <div className="filters resource-filters">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="up-level">{t("upcoming.category")}</label>
            <select id="up-level" className="input" value={level} onChange={(e) => set({ level: e.target.value })}>
              <option value="">{t("upcoming.allCategories")}</option>
              {LEVELS.map((k) => <option key={k} value={k}>{t(`res.level.${k}`)}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="up-scope">{t("upcoming.scope")}</label>
            <select id="up-scope" className="input" value={scope} onChange={(e) => set({ scope: e.target.value })}>
              <option value="">{t("upcoming.allScopes")}</option>
              {SCOPES.map((k) => <option key={k} value={k}>{t(`scope.${k}`)}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="up-days">{t("upcoming.horizon")}</label>
            <select id="up-days" className="input" value={days} onChange={(e) => set({ days: e.target.value })}>
              {HORIZONS.map((d) => (
                <option key={d || "all"} value={d}>{d ? t("upcoming.nextDays", { n: d }) : t("upcoming.anyTime")}</option>
              ))}
            </select>
          </div>
        </div>

        {list.status === "loading" && <Loading label={t("upcoming.loading")} />}
        {list.status === "error" && <ErrorNotice message={list.error} onRetry={list.reload} />}
        {list.status === "ready" && (
          <>
            <p className="small muted" role="status" style={{ margin: "var(--space-4) 0" }}>
              {list.data.total === 1 ? t("upcoming.oneResult") : t("upcoming.results", { n: list.data.total })}
            </p>
            {list.data.total === 0 ? (
              <p className="notice">{t("upcoming.none")}</p>
            ) : (
              groups.map((g) => (
                <div key={g.key} style={{ marginBottom: "var(--space-6)" }}>
                  <h2 className="h3" style={{ marginBottom: "var(--space-3)" }}>{formatMonth(g.key, lang)}</h2>
                  <div className="option-grid">
                    {g.items.map((e) => <EventCard key={e.key} e={e} />)}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
          {t("upcoming.disclaimer")}
        </p>
      </div>
    </section>
  );
}
