import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, OfficialLink, VerifiedBadge } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

// Labels: res.tab.*, res.level.* in i18n/*.js
const TABS = ["exams", "colleges", "scholarships"];
const EXAM_LEVELS = ["ug_admission", "pg_admission", "doctoral", "government_job", "other"];

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function Checked({ date }) {
  const { t } = useI18n();
  return <span className="muted small">{t("res.lastChecked", { date })}</span>;
}

function ExamCard({ e }) {
  const { t, tOr } = useI18n();
  return (
    <article className="card resource-card" aria-labelledby={`r-${e.exam_id}`}>
      <div className="option-card__head">
        <h3 id={`r-${e.exam_id}`} className="option-card__title">{e.name}</h3>
        <span className="badge">{tOr(`res.level.${e.exam_level}`, e.exam_level)}</span>
      </div>
      <p className="muted small">{e.full_name} · {e.conducting_body}</p>
      <p className="small">{e.purpose}</p>
      <dl className="dl small">
        <dt>{t("next.eligibility")}</dt><dd>{e.eligibility_summary}</dd>
        {e.typical_month && (<><dt>{t("res.when")}</dt><dd>{e.typical_month}{e.frequency ? ` · ${e.frequency}` : ""}</dd></>)}
        {e.age_limit_note && (<><dt>{t("res.ageLimit")}</dt><dd>{e.age_limit_note}</dd></>)}
      </dl>
      <div className="option-card__foot small">
        <VerifiedBadge verified={e.verified} date={e.last_verified} />
        <OfficialLink href={e.official_url}>{t("res.official")}</OfficialLink>
        <Checked date={e.last_verified} />
      </div>
    </article>
  );
}

function CollegeCard({ c }) {
  const { t } = useI18n();
  return (
    <article className="card resource-card" aria-labelledby={`r-${c.college_id}`}>
      <div className="option-card__head">
        <h3 id={`r-${c.college_id}`} className="option-card__title">{c.name}</h3>
        <span className="badge">{c.type_label}</span>
      </div>
      <p className="muted small">{[c.city, c.state].filter(Boolean).join(", ")}{c.university ? ` · ${c.university}` : ""}</p>
      <dl className="dl small">
        <dt>{t("res.programmes")}</dt><dd>{c.programmes.map((p) => p.name).join(", ")}</dd>
        {c.exams.length > 0 && (
          <><dt>{t("res.admissionVia")}</dt><dd>{c.exams.map((e, i) => (
            <span key={e.exam_id}>{i > 0 && ", "}<OfficialLink href={e.official_url}>{e.name}</OfficialLink></span>))}</dd></>
        )}
        <dt>{t("res.fees")}</dt><dd>{c.fees_note || t("res.checkOfficial")}</dd>
        {c.nirf_rank && (<><dt>NIRF</dt><dd>#{c.nirf_rank} ({c.nirf_year})</dd></>)}
      </dl>
      <div className="option-card__foot small">
        <OfficialLink href={c.official_url}>{t("res.official")}</OfficialLink>
        <Checked date={c.last_verified} />
      </div>
    </article>
  );
}

function ScholarshipCard({ s }) {
  const { t } = useI18n();
  const notes = [s.gender_note, s.category_note, s.income_limit_note, s.state_restriction].filter(Boolean);
  return (
    <article className="card resource-card" aria-labelledby={`r-${s.scholarship_id}`}>
      <div className="option-card__head">
        <h3 id={`r-${s.scholarship_id}`} className="option-card__title">{s.name}</h3>
        <span className="badge">{s.provider_label}</span>
      </div>
      <p className="muted small">{s.provider}</p>
      <p className="small">{s.eligibility_summary}</p>
      <dl className="dl small">
        {notes.length > 0 && (<><dt>{t("res.conditions")}</dt><dd>{notes.join(" · ")}</dd></>)}
        {s.amount_note && (<><dt>{t("res.amount")}</dt><dd>{s.amount_note}</dd></>)}
        {s.application_window_note && (<><dt>{t("res.howApply")}</dt><dd>{s.application_window_note}</dd></>)}
      </dl>
      <div className="option-card__foot small">
        <VerifiedBadge verified={s.verified} date={s.last_verified} />
        <OfficialLink href={s.official_url}>{t("res.official")}</OfficialLink>
        <Checked date={s.last_verified} />
      </div>
    </article>
  );
}

export default function ResourcesPage() {
  const { status: authStatus } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "exams";
  const get = (k) => params.get(k) || "";
  const [search, setSearch] = useState(get("q"));
  const q = useDebounced(search);
  const filters = useRequest(() => api.getResourceFilters(), []);

  const set = (updates) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get("q") || "") !== q) set({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = {
    q, for_me: get("mine") === "1",
    ...(tab === "exams" ? { level: get("level") } : {}),
    ...(tab === "colleges" ? { state: get("state"), type: get("type"), exam: get("exam") } : {}),
    ...(tab === "scholarships" ? { provider_type: get("provider") } : {}),
  };
  const list = useRequest(
    (signal) => (authStatus === "loading" ? new Promise(() => {}) : api.getResources(tab, query, signal)),
    [tab, JSON.stringify(query), authStatus],
  );
  const f = filters.data;
  const Card = { exams: ExamCard, colleges: CollegeCard, scholarships: ScholarshipCard }[tab];
  const idKey = { exams: "exam_id", colleges: "college_id", scholarships: "scholarship_id" }[tab];

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("res.title")}</h1>
            <p className="muted">{t("res.lead")}</p>
          </div>
        </div>

        <div className="tabs" role="group" aria-label={t("res.chooseList")}>
          {TABS.map((key) => (
            <button key={key} type="button" className="tab" aria-pressed={tab === key}
              onClick={() => { setSearch(""); setParams({ tab: key }); }}>
              {t(`res.tab.${key}`)}
            </button>
          ))}
        </div>

        <div className="filters resource-filters">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="res-q">{t("careers.search")}</label>
            <input id="res-q" className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "colleges" ? t("res.nameCity") : t("res.nameKeyword")} />
          </div>
          {tab === "exams" && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field__label" htmlFor="res-level">{t("res.type")}</label>
              <select id="res-level" className="input" value={get("level")} onChange={(e) => set({ level: e.target.value })}>
                <option value="">{t("res.allTypes")}</option>
                {EXAM_LEVELS.map((k) => <option key={k} value={k}>{t(`res.level.${k}`)}</option>)}
              </select>
            </div>
          )}
          {tab === "colleges" && f && (
            <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="res-state">{t("res.state")}</label>
                <select id="res-state" className="input" value={get("state")} onChange={(e) => set({ state: e.target.value })}>
                  <option value="">{t("res.allStates")}</option>
                  {f.states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="res-type">{t("res.type")}</label>
                <select id="res-type" className="input" value={get("type")} onChange={(e) => set({ type: e.target.value })}>
                  <option value="">{t("res.allTypes")}</option>
                  {f.institution_types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}
          {tab === "scholarships" && f && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field__label" htmlFor="res-provider">{t("res.provider")}</label>
              <select id="res-provider" className="input" value={get("provider")} onChange={(e) => set({ provider: e.target.value })}>
                <option value="">{t("res.allProviders")}</option>
                {f.provider_types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          {tab !== "colleges" && (
            <label className="radio-inline small resource-mine">
              <input type="checkbox" checked={get("mine") === "1"} onChange={(e) => set({ mine: e.target.checked ? "1" : "" })} />
              {t("res.mine")}
            </label>
          )}
        </div>

        {list.status === "loading" && <Loading label={t("res.loading")} />}
        {list.status === "error" && <ErrorNotice message={list.error} onRetry={list.reload} />}
        {list.status === "ready" && (
          <>
            <p className="small muted" role="status" style={{ margin: "var(--space-4) 0" }}>
              {list.data.total === 1 ? t("res.oneResult") : t("res.results", { n: list.data.total })}
              {list.data.note && <> · {list.data.note}</>}
            </p>
            {list.data.note && /log in/i.test(list.data.note) && authStatus !== "authenticated" && (
              <p className="small"><Link to="/login">{t("header.login")}</Link> {t("res.loginFilter")}</p>
            )}
            {list.data.total === 0 ? (
              <p className="notice">{t("res.none")}</p>
            ) : (
              <div className="option-grid">
                {list.data.items.map((item) => <Card key={item[idKey]} {...{ [tab === "exams" ? "e" : tab === "colleges" ? "c" : "s"]: item }} />)}
              </div>
            )}
          </>
        )}

        <p className="notice small" style={{ marginTop: "var(--space-6)" }}>
          {t("res.disclaimer")}
        </p>
      </div>
    </section>
  );
}
