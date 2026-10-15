import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import { groupStages } from "../degreeFamilies";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

// Labels: fees.band.<key>, fees.period.<key> in i18n/*.js
const BANDS = ["income_above_5l", "income_1_to_5l", "income_below_1l", "sc_st_pwd"];

function rupees(n, lang) {
  return `₹${Number(n).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN")}`;
}

function FeeCard({ f }) {
  const { t, lang } = useI18n();
  return (
    <article className="card option-card" aria-labelledby={`fee-${f.fee_id}`}>
      <div className="option-card__head">
        <h3 id={`fee-${f.fee_id}`} className="option-card__title">{f.institution}</h3>
        <span className="badge">{t(`fees.period.${f.period}`)}</span>
      </div>
      <p className="fee-amount">{rupees(f.amount, lang)}</p>
      <p className="muted small">{t(`fees.band.${f.band}`)}</p>
      <dl className="dl small">
        <dt>{t("fees.includes")}</dt>
        <dd>{f.includes_note}</dd>
        {f.excludes_note && (<><dt>{t("fees.excludes")}</dt><dd>{f.excludes_note}</dd></>)}
        {f.waiver_note && (<><dt>{t("fees.waiver")}</dt><dd>{f.waiver_note}</dd></>)}
      </dl>
      <div className="option-card__foot small muted">
        <OfficialLink href={f.source_url}>{f.source_name}</OfficialLink>
      </div>
    </article>
  );
}

export default function FeesPage() {
  const { t } = useI18n();
  const { status: authStatus } = useAuth();
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") || "";
  const band = BANDS.includes(params.get("band")) ? params.get("band") : "";
  const set = (updates) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const stages = useRequest(() => api.getStages(), []);
  const data = useRequest(
    (signal) => (authStatus === "loading" ? new Promise(() => {})
      : api.getFees({ stage: stage || undefined, band: band || undefined, forMe: !stage }, signal)),
    [stage, band, authStatus],
  );
  const grouped = useMemo(() => (stages.data ? groupStages(stages.data.filter((s) => s.level !== "course"), t) : []),
    [stages.data, t]);
  const d = data.data;
  const selected = stage || d?.stage?.stage_id || "";

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("fees.title")}</h1>
            <p className="muted">{t("fees.lead")}</p>
          </div>
        </div>

        <div className="filters resource-filters">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="fees-stage">{t("fees.study")}</label>
            <select id="fees-stage" className="input" value={selected} onChange={(e) => set({ stage: e.target.value })}>
              <option value="">{t("fees.chooseStudy")}</option>
              {grouped.map(([label, items]) => (
                <optgroup key={label} label={label}>
                  {items.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="fees-band">{t("fees.bandLabel")}</label>
            <select id="fees-band" className="input" value={band} onChange={(e) => set({ band: e.target.value })}>
              <option value="">{t("fees.allBands")}</option>
              {BANDS.map((b) => <option key={b} value={b}>{t(`fees.band.${b}`)}</option>)}
            </select>
          </div>
        </div>

        {data.status === "loading" && <Loading label={t("fees.loading")} />}
        {data.status === "error" && <ErrorNotice message={data.error} onRetry={data.reload} />}
        {data.status === "ready" && !d.stage && (
          <p className="notice" style={{ marginTop: "var(--space-5)" }}>{t("fees.pick")}</p>
        )}
        {data.status === "ready" && d.stage && (
          <>
            <h2 style={{ marginTop: "var(--space-5)" }}>{d.stage.name}</h2>
            {d.note && <p className="small muted">{d.note}</p>}

            <section className="detail-block" aria-labelledby="fees-official">
              <h2 id="fees-official" className="group-title">{t("fees.official")}</h2>
              {d.fees.length > 0 ? (
                <div className="option-grid">{d.fees.map((f) => <FeeCard key={f.fee_id} f={f} />)}</div>
              ) : (
                <p className="notice">{d.has_official_fees ? t("fees.noneForBand") : t("fees.noneYet")}</p>
              )}
            </section>

            <section className="detail-block" aria-labelledby="fees-help">
              <h2 id="fees-help" className="group-title">{t("fees.help")}</h2>
              {d.scholarships.length === 0 ? (
                <p className="muted">{t("fees.noScholarships")} <Link to="/resources?tab=scholarships">{t("fees.allScholarships")}</Link></p>
              ) : (
                <div className="option-grid">
                  {d.scholarships.map((s) => (
                    <article key={s.scholarship_id} className="card option-card">
                      <h3 className="option-card__title">
                        <OfficialLink href={s.official_url}>{s.name}</OfficialLink>
                      </h3>
                      <p className="muted small">{s.provider} · {s.provider_label}</p>
                      <p className="small">{s.eligibility_summary}</p>
                      <dl className="dl small">
                        {s.income_limit_note && (<><dt>{t("fees.income")}</dt><dd>{s.income_limit_note}</dd></>)}
                        {(s.gender_note || s.category_note) && (
                          <><dt>{t("fees.who")}</dt><dd>{[s.gender_note, s.category_note].filter(Boolean).join(" · ")}</dd></>
                        )}
                        {s.amount_note && (<><dt>{t("fees.amount")}</dt><dd>{s.amount_note}</dd></>)}
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-6)" }}>{t("fees.disclaimer")}</p>
      </div>
    </section>
  );
}
