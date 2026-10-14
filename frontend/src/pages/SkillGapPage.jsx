import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, Meter } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

const weeks = (t, n) => (n === 1 ? t("gap.oneWeek") : t("gap.weeks", { n }));
const level = (t, value) => (value === "none" ? "–" : t(`gap.level.${value}`));

function GapTable({ items, caption }) {
  const { t } = useI18n();
  return (
    <div className="table-wrap">
      <table className="table table--stack">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t("profile.item.skill")}</th>
            <th scope="col">{t("gap.youNow")}</th>
            <th scope="col">{t("gap.needed")}</th>
            <th scope="col">{t("gap.importance")}</th>
            <th scope="col">{t("gap.roughTime")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.skill_id}>
              <td data-label={t("gap.priority")}>{i.rank}</td>
              <th scope="row">
                <span className="gap-name">{i.name}</span>
                <span className={`badge badge--${i.status}`}>{t(`gap.status.${i.status}`)}</span>
                {i.description && <span className="muted small gap-desc">{i.description}</span>}
              </th>
              <td data-label={t("gap.youNow")}>{level(t, i.current_level)}</td>
              <td data-label={t("gap.needed")}>{level(t, i.required_level)}</td>
              <td data-label={t("gap.importance")}>
                <span role="img" aria-label={t("gap.importanceOf", { n: i.importance })}>
                  {"●".repeat(i.importance)}<span className="dim">{"●".repeat(5 - i.importance)}</span>
                </span>
              </td>
              <td data-label={t("gap.roughTime")}>{weeks(t, i.weeks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CareerPicker({ value, onChange }) {
  const { t } = useI18n();
  const careers = useRequest((signal) => api.getCareers({ limit: 100 }, signal), []);
  if (careers.status !== "ready") return null;
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label className="field__label" htmlFor="gap-career">{t("gap.target")}</label>
      <select id="gap-career" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{t("gap.chooseCareer")}</option>
        {careers.data.items.map((c) => <option key={c.career_id} value={c.career_id}>{c.name}</option>)}
      </select>
    </div>
  );
}

function Suggestions({ onPick }) {
  const { t } = useI18n();
  const rec = useRequest((signal) => api.getRecommendations({ limit: 3 }, signal), []);
  if (rec.status !== "ready" || rec.data.items.length === 0) return null;
  return (
    <div className="notice" style={{ marginTop: "var(--space-5)" }}>
      <p>{t("gap.topMatches")}</p>
      <div className="btn-row">
        {rec.data.items.map((i) => (
          <button key={i.career_id} type="button" className="btn btn--secondary btn--small" onClick={() => onPick(i.career_id)}>
            {i.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SkillGapPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const career = params.get("career") || "";
  const pick = (id) => setParams(id ? { career: id } : {});
  const gap = useRequest((signal) => (career ? api.getSkillGap(career, signal) : Promise.resolve(null)), [career]);

  // The server's code is language-independent; the text check covers older servers
  const noProfile = gap.raw?.response?.data?.code?.startsWith("profile.missing") || /profile/i.test(gap.error || "");
  if (gap.status === "error" && api.isNotFound(gap.raw) && noProfile) {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>{t("rec.profileFirst")}</h1>
          <p className="muted">{t("gap.profileFirst.text")}</p>
          <Link to="/profile/quick" className="btn btn--primary">{t("profile.create")}</Link>
        </div>
      </section>
    );
  }

  const d = gap.data;
  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("rec.skillGap")}</h1>
            <p className="muted">{t("gap.lead")}</p>
          </div>
        </div>
        <div className="toolbar">
          <CareerPicker value={career} onChange={pick} />
          {d && (
            <p className="small muted" style={{ margin: 0 }}>
              <Link to={`/careers/${d.career.career_id}`}>{t("gap.aboutCareer")}</Link> ·{" "}
              <Link to={`/roadmap?career=${d.career.career_id}`}>{t("gap.toRoadmap")}</Link>
            </p>
          )}
        </div>

        {!career && <Suggestions onPick={pick} />}
        {gap.status === "loading" && career && <Loading label={t("gap.loading")} />}
        {gap.status === "error" && <ErrorNotice message={gap.error} onRetry={gap.reload} />}

        {d && (
          <>
            <div className="gap-summary">
              <div className="card summary-card">
                <p className="muted small">{t("gap.readiness", { name: d.career.name })}</p>
                <p className="summary-card__big">{Math.round(d.readiness)}%</p>
                <Meter value={d.readiness} label={t("gap.readiness", { name: d.career.name })} />
              </div>
              <div className="card summary-card">
                <p className="muted small">{t("gap.coreReady")}</p>
                <p className="summary-card__big">{d.core_ready} / {d.core_total}</p>
              </div>
              <div className="card summary-card">
                <p className="muted small">{t("gap.coreTime")}</p>
                <p className="summary-card__big">{weeks(t, d.estimate.core_weeks)}</p>
                <p className="muted small">{t("gap.hoursPerWeek", { n: d.estimate.hours_per_week })}</p>
              </div>
            </div>

            {!d.has_skills && (
              <p className="notice">
                {t("gap.noSkills")}{" "}<Link to="/profile/edit">{t("gap.addSkills")}</Link>.
              </p>
            )}

            {d.learn_first.length > 0 && (
              <section className="detail-block" aria-labelledby="learn-first">
                <h2 id="learn-first" className="group-title">{t("gap.learnFirst")}</h2>
                <GapTable items={d.learn_first} caption={t("gap.learnFirst.caption")} />
              </section>
            )}
            {d.learn_next.length > 0 && (
              <section className="detail-block" aria-labelledby="learn-next">
                <h2 id="learn-next" className="group-title">{t("gap.learnNext")}</h2>
                <GapTable items={d.learn_next} caption={t("gap.learnNext.caption")} />
              </section>
            )}
            {d.learn_first.length === 0 && d.learn_next.length === 0 && (
              <p className="notice">{t("gap.allDone")}</p>
            )}

            {d.have.length > 0 && (
              <section className="detail-block" aria-labelledby="have">
                <h2 id="have" className="group-title">{t("gap.have")}</h2>
                <ul className="tag-list">
                  {d.have.map((i) => <li key={i.skill_id} className="badge badge--ok">{i.name} · {level(t, i.current_level)}</li>)}
                </ul>
              </section>
            )}
            {d.transferable.length > 0 && (
              <p className="small muted">{t("gap.transferable", { list: d.transferable.join(", ") })}</p>
            )}
            {d.unmatched_skills.length > 0 && (
              <p className="small muted">{t("rec.unmatched", { list: d.unmatched_skills.join(", ") })}.</p>
            )}
            <p className="notice small" style={{ marginTop: "var(--space-6)" }}>{t("gap.disclaimer")}</p>
          </>
        )}
      </div>
    </section>
  );
}
