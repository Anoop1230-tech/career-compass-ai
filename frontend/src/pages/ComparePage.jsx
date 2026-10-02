import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

const MAX = 3;

/** Picks up to three careers and an optional starting stage; everything lives in the URL. */
function Pickers({ ids, stage, onChange, loggedIn }) {
  const { t } = useI18n();
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  const stages = useRequest(() => api.getStages(), []);
  if (careers.status === "error") return <ErrorNotice message={careers.error} onRetry={careers.reload} />;
  if (careers.status !== "ready") return <Loading label={t("dream.loadingChoices")} minHeight={120} />;
  const slots = [...ids, ...Array(MAX - ids.length).fill("")].slice(0, MAX);
  const setSlot = (index, value) => {
    const next = slots.map((v, i) => (i === index ? value : v)).filter(Boolean);
    onChange({ ids: [...new Set(next)], stage });
  };
  return (
    <div className="toolbar compare-pickers">
      {slots.map((value, i) => (
        <div key={i} className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor={`compare-${i}`}>
            {t("compare.career", { n: i + 1 })}{i === 2 && <span className="field__optional"> {t("common.optional")}</span>}
          </label>
          <select id={`compare-${i}`} className="input" value={value} onChange={(e) => setSlot(i, e.target.value)}>
            <option value="">{t("gap.chooseCareer")}</option>
            {careers.data.items.map((c) => (
              <option key={c.career_id} value={c.career_id} disabled={c.career_id !== value && slots.includes(c.career_id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      {stages.status === "ready" && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="compare-stage">{t("compare.from")}</label>
          <select id="compare-stage" className="input" value={stage} onChange={(e) => onChange({ ids, stage: e.target.value })}>
            <option value="">{loggedIn ? t("dream.useProfile") : t("compare.noStage")}</option>
            {stages.data.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function Route({ route }) {
  const { t } = useI18n();
  if (!route) return <span className="muted">{t("compare.chooseStage")}</span>;
  if (!route.reachable) return <span className="badge badge--missing">{t("compare.notDirect")}</span>;
  const study = route.steps.filter((s) => s.type === "education");
  return (
    <>
      <strong>{study.length === 0 ? t("compare.directNow") : t("compare.studyYears", { n: route.years })}</strong>
      {study.length > 0 && <span className="muted small"> · {study.map((s) => s.title).join(" → ")}</span>}
    </>
  );
}

function List({ items, empty }) {
  const { t } = useI18n();
  if (!items.length) return <span className="muted">{empty || t("compare.none")}</span>;
  return items.join(", ");
}

export default function ComparePage() {
  const { t, tOr } = useI18n();
  const { status: authStatus } = useAuth();
  const loggedIn = authStatus === "authenticated";
  const [params, setParams] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX);
  const stage = params.get("stage") || "";
  const key = `${ids.join(",")}|${stage}`;
  const result = useRequest(
    (signal) => (ids.length < 2 || authStatus === "loading" ? Promise.resolve(null) : api.compareCareers(ids, stage, signal)),
    [key, authStatus],
  );
  const update = ({ ids: next, stage: s }) => {
    const q = {};
    if (next.length) q.ids = next.join(",");
    if (s) q.stage = s;
    setParams(q, { replace: true });
  };
  const d = result.data;

  // One row per attribute; each career is a column (stacks into cards on phones)
  const rows = d ? [
    ["compare.row.field", (c) => `${tOr(`domain.${c.domain}`, c.domain)}${c.sub_domain ? ` · ${c.sub_domain}` : ""}`],
    ["compare.row.minEducation", (c) => tOr(`detail.level.${c.min_education_level}`, c.min_education_level)],
    ["compare.row.route", (c) => <Route route={c.route} />],
    ["compare.row.entry", (c) => <List items={c.entry_stages.map((s) => s.name)} />],
    ["compare.row.exams", (c) => (c.exams.length ? c.exams.map((e, i) => (
      <span key={e.exam_id}>{i > 0 && ", "}<OfficialLink href={e.official_url}>{e.name}</OfficialLink></span>))
      : <span className="muted">{t("compare.noExams")}</span>)],
    ["compare.row.core", (c) => <List items={c.core_skills} />],
    ["compare.row.helpful", (c) => <List items={c.other_skills} />],
    ["compare.row.workSetting", (c) => <List items={c.work_style.map((w) => tOr(`detail.ws.${w}`, w))} />],
    ["compare.row.next", (c) => <List items={c.next_careers.map((n) => n.name)} empty={t("detail.noNext")} />],
    ...(d.personalised ? [
      ["compare.row.fit", (c) => <><strong>{Math.round(c.fit.score)}/100</strong>
        <Meter value={c.fit.score} label={t("compare.fitFor", { name: c.name })} /></>],
      ["compare.row.readiness", (c) => <><strong>{Math.round(c.fit.readiness)}%</strong>
        <Meter value={c.fit.readiness} label={t("gap.readiness", { name: c.name })} /></>],
    ] : []),
  ] : [];

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("compare.title")}</h1>
            <p className="muted">{t("compare.lead")}</p>
          </div>
        </div>

        <Pickers ids={ids} stage={stage} onChange={update} loggedIn={loggedIn} />

        {ids.length < 2 && <p className="notice" style={{ marginTop: "var(--space-5)" }}>{t("compare.pickTwo")}</p>}
        {result.status === "loading" && ids.length >= 2 && <Loading label={t("compare.loading")} />}
        {result.status === "error" && <ErrorNotice message={result.error} onRetry={result.reload} />}

        {d && (
          <>
            {d.stage && <p className="small muted" style={{ marginTop: "var(--space-4)" }}>{t("compare.startingFrom", { name: d.stage.name })}</p>}
            <div className="table-wrap compare-wrap">
              <table className="table table--stack compare-table">
                <caption className="visually-hidden">{t("compare.caption", { list: d.careers.map((c) => c.name).join(", ") })}</caption>
                <thead>
                  <tr>
                    <td />
                    {d.careers.map((c) => (
                      <th key={c.career_id} scope="col">
                        <Link to={`/careers/${c.career_id}`}>{c.name}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, cell]) => (
                    <tr key={label}>
                      <th scope="row">{t(label)}</th>
                      {d.careers.map((c) => <td key={c.career_id} data-label={c.name}>{cell(c)}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{t("compare.row.next_steps")}</th>
                    {d.careers.map((c) => (
                      <td key={c.career_id} data-label={c.name}>
                        <div className="btn-row">
                          <Link to={`/skill-gap?career=${c.career_id}`} className="btn btn--secondary btn--small">{t("rec.skillGap")}</Link>
                          <Link to={`/roadmap?career=${c.career_id}`} className="btn btn--secondary btn--small">{t("nav.roadmap")}</Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {d.shared_skills.length > 0 && (
              <p className="notice" style={{ marginTop: "var(--space-5)" }}>{t("compare.shared", { list: d.shared_skills.join(", ") })}</p>
            )}
            {!d.personalised && (
              <p className="small"><Link to="/login">{t("header.login")}</Link> {t("compare.loginHint")}</p>
            )}
            <p className="notice small" style={{ marginTop: "var(--space-5)" }}>{t("compare.disclaimer")}</p>
          </>
        )}
      </div>
    </section>
  );
}
