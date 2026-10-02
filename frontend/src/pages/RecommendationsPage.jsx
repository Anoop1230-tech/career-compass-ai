import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

// Texts: rec.* in i18n/*.js

export function FitBreakdown({ item }) {
  const { t } = useI18n();
  return (
    <ul className="score-list fit-breakdown">
      {item.components.map((c) => (
        <li key={c.key}>
          <div className="score-list__head small">
            <span>{t(`rec.signal.${c.key}`)} <span className="muted">· {t("rec.weight", { n: c.weight })}</span></span>
            <span className="muted">{c.available ? `${Math.round(c.score)}/100` : t("rec.notAvailable")}</span>
          </div>
          {c.available ? <Meter value={c.score} label={t("rec.signalFor", { signal: t(`rec.signal.${c.key}`), name: item.name })} /> : <div className="meter" aria-hidden="true" />}
          {c.explanation && <p className="muted small">{c.explanation}</p>}
        </li>
      ))}
    </ul>
  );
}

const REASONS = ["not_interested", "too_hard_to_reach", "skills_mismatch", "pay_or_lifestyle", "other"];

/** "Does this fit you?" – saved per career; used to check the engine against real answers. */
function Feedback({ item }) {
  const { t } = useI18n();
  const [value, setValue] = useState(item.feedback);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = `fb-${item.career_id}`;

  const save = async (verdict, reason) => {
    const previous = value;
    setValue({ verdict, reason: reason || null }); // show at once; roll back on error
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveRecommendationFeedback(item.career_id, verdict, reason);
      setValue(saved.feedback);
    } catch (err) {
      setValue(previous);
      setError(api.getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    const previous = value;
    setValue(null);
    setError("");
    try {
      await api.deleteRecommendationFeedback(item.career_id);
    } catch (err) {
      setValue(previous);
      setError(api.getErrorMessage(err));
    }
  };

  return (
    <fieldset className="rec-feedback small" disabled={busy}>
      <legend>{t("rec.fb.question", { name: item.name })}</legend>
      <div className="btn-row">
        <button type="button" className={`btn btn--small ${value?.verdict === "fits" ? "btn--primary" : "btn--secondary"}`}
          aria-pressed={value?.verdict === "fits"} onClick={() => save("fits")}>{t("rec.fb.fits")}</button>
        <button type="button" className={`btn btn--small ${value?.verdict === "not_for_me" ? "btn--primary" : "btn--secondary"}`}
          aria-pressed={value?.verdict === "not_for_me"} onClick={() => save("not_for_me", value?.reason)}>{t("rec.fb.notForMe")}</button>
        {value && <button type="button" className="link-button small" onClick={clear}>{t("rec.fb.remove")}</button>}
      </div>
      {value?.verdict === "not_for_me" && (
        <div className="field" style={{ margin: "var(--space-3) 0 0" }}>
          <label className="field__label" htmlFor={`${name}-reason`}>{t("rec.fb.reason")} <span className="field__optional">{t("common.optional")}</span></label>
          <select id={`${name}-reason`} className="input" value={value.reason || ""}
            onChange={(e) => save("not_for_me", e.target.value || undefined)}>
            <option value="">{t("rec.fb.chooseReason")}</option>
            {REASONS.map((r) => <option key={r} value={r}>{t(`rec.fb.reason.${r}`)}</option>)}
          </select>
        </div>
      )}
      {value && !error && <p className="muted small" role="status" style={{ margin: "var(--space-2) 0 0" }}>{t("rec.fb.saved")}</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </fieldset>
  );
}

function RecommendationCard({ item, rank }) {
  const { t, tOr } = useI18n();
  const [open, setOpen] = useState(false);
  const id = `rec-${item.career_id}`;
  return (
    <article className="card rec-card" aria-labelledby={id}>
      <div className="rec-card__head">
        <span className="rec-card__rank" aria-hidden="true">{rank}</span>
        <div className="rec-card__title">
          <h2 id={id}><Link to={`/careers/${item.career_id}`}>{item.name}</Link></h2>
          <p className="muted small">{tOr(`domain.${item.domain}`, item.domain)}{item.sub_domain ? ` · ${item.sub_domain}` : ""}</p>
        </div>
        <div className="rec-card__score" aria-label={t("rec.match", { n: Math.round(item.score) })}>
          <strong>{Math.round(item.score)}</strong><span className="muted small">/100</span>
        </div>
      </div>
      <p className="small">{item.description}</p>

      {item.strengths.length > 0 && (
        <div className="small">
          <strong>{t("rec.whyFits")}</strong>
          <ul className="plain-list">{item.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {item.concerns.length > 0 && (
        <div className="small">
          <strong>{t("rec.keepInMind")}</strong>
          <ul className="plain-list">{item.concerns.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {item.skills_to_learn.length > 0 && (
        <p className="small muted" style={{ margin: 0 }}>{t("next.coreToLearn", { list: item.skills_to_learn.join(", ") })}</p>
      )}

      <div className="btn-row">
        <Link to={`/skill-gap?career=${item.career_id}`} className="btn btn--secondary btn--small">{t("rec.skillGap")}</Link>
        <Link to={`/roadmap?career=${item.career_id}`} className="btn btn--secondary btn--small">{t("nav.roadmap")}</Link>
        <button type="button" className="link-button small" aria-expanded={open} aria-controls={`${id}-why`}
          onClick={() => setOpen((v) => !v)}>
          {open ? t("rec.hideDetails") : t("rec.howMade")}
        </button>
      </div>
      {open && <div id={`${id}-why`}><FitBreakdown item={item} /></div>}
      <Feedback item={item} />
    </article>
  );
}

export default function RecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const domain = params.get("domain") || "";
  const { t, tOr } = useI18n();
  const rec = useRequest((signal) => api.getRecommendations({ domain, limit: 15 }, signal), [domain]);

  if (rec.status === "error" && api.isNotFound(rec.raw)) {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>{t("rec.profileFirst")}</h1>
          <p className="muted">{t("rec.profileFirst.text")}</p>
          <Link to="/profile/edit" className="btn btn--primary">{t("profile.create")}</Link>
        </div>
      </section>
    );
  }

  const data = rec.data;
  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("rec.title")}</h1>
            <p className="muted">{t("rec.lead")}</p>
          </div>
          {data && (
            <div className="field" style={{ margin: 0, minWidth: 200 }}>
              <label className="field__label" htmlFor="rec-domain">{t("rec.area")}</label>
              <select id="rec-domain" className="input" value={domain}
                onChange={(e) => setParams(e.target.value ? { domain: e.target.value } : {})}>
                <option value="">{t("rec.allAreas")}</option>
                {data.domains.map((d) => <option key={d} value={d}>{tOr(`domain.${d}`, d)}</option>)}
              </select>
            </div>
          )}
        </div>

        {rec.status === "loading" && <Loading label={t("rec.loading")} />}
        {rec.status === "error" && <ErrorNotice message={rec.error} onRetry={rec.reload} />}

        {rec.status === "ready" && (
          <>
            <div className="notice confidence">
              <p style={{ margin: 0 }}>
                <strong>{t("rec.confidence", { n: data.confidence.percent })}</strong> · {t(`rec.level.${data.confidence.level}`)}
                {data.stage?.name && <> {t("rec.startingPoint", { name: data.stage.name })}</>}
              </p>
              {data.confidence.improve.length > 0 && (
                <ul className="tag-list" style={{ marginTop: "var(--space-3)" }}>
                  {data.confidence.improve.map((t) => (
                    <li key={t.key}><Link to={t.link} className="btn btn--secondary btn--small">{t.text}</Link></li>
                  ))}
                </ul>
              )}
              {data.unmatched_skills.length > 0 && (
                <p className="small muted" style={{ margin: "var(--space-3) 0 0" }}>
                  {t("rec.unmatched", { list: data.unmatched_skills.join(", ") })}
                </p>
              )}
            </div>

            {data.items.length === 0 ? (
              <p className="notice" style={{ marginTop: "var(--space-5)" }}>
                {t("rec.needMore")}
              </p>
            ) : (
              <div className="rec-list">
                {data.items.map((item, i) => <RecommendationCard key={item.career_id} item={item} rank={i + 1} />)}
              </div>
            )}

            <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
              {t("rec.howScores", { ...data.weights })}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
