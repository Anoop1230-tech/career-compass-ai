import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import * as api from "../services/api";

/** Date or month text for an event: exact dates as dates, indicative ones as "usually in <month>". */
function eventWhen(e, lang, t) {
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  const fmt = (iso, opts) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, opts);
  if (!e.exact) return t("rem.usually", { month: fmt(e.start, { month: "long", year: "numeric" }) });
  const day = { day: "numeric", month: "short", year: "numeric" };
  return e.start === e.end ? fmt(e.start, day) : `${fmt(e.start, day)} – ${fmt(e.end, day)}`;
}

/** Dashboard section: the next events of followed exams, email on/off, calendar download. */
export default function ComingUp({ data, onChange }) {
  const { t, lang } = useI18n();
  if (!data) return null;
  const events = data.events.slice(0, 6);
  const toggle = async (exam) => onChange(await api.followExam(exam.exam_id, !exam.email));
  const remove = async (exam) => { await api.unfollowExam(exam.exam_id); onChange(await api.getReminders()); };

  return (
    <section className="card" aria-labelledby="coming-up-title" style={{ marginTop: "var(--space-6)" }}>
      <h2 id="coming-up-title" style={{ fontSize: "var(--text-xl)" }}>{t("rem.title")}</h2>
      {data.exams.length === 0 ? (
        <p className="muted">{t("rem.empty")} <Link to="/resources?tab=exams">{t("rem.browse")}</Link></p>
      ) : (
        <>
          {events.length === 0 ? <p className="muted">{t("rem.noEvents")}</p> : (
            <ul className="plain-list">
              {events.map((e) => (
                <li key={e.key} style={{ marginBottom: "var(--space-2)" }}>
                  <strong>{e.exam_name}</strong>: {t(`rem.event.${e.event}`)} · {eventWhen(e, lang, t)}
                  {!e.exact && <span className="badge" style={{ marginInlineStart: "var(--space-2)" }}>{t("rem.notConfirmed")}</span>}
                </li>
              ))}
            </ul>
          )}
          <h3 className="small" style={{ marginTop: "var(--space-4)" }}>{t("rem.following")}</h3>
          <ul className="plain-list">
            {data.exams.map((x) => (
              <li key={x.exam_id} className="btn-row" style={{ alignItems: "center", marginBottom: "var(--space-2)" }}>
                <span>{x.name}</span>
                <label className="radio-inline small">
                  <input type="checkbox" checked={x.email} onChange={() => toggle(x)} /> {t("rem.emailMe", { name: x.name })}
                </label>
                <button type="button" className="btn btn--secondary btn--small" onClick={() => remove(x)}>
                  {t("rem.unfollow")}<span className="visually-hidden"> {x.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="btn-row" style={{ marginTop: "var(--space-4)" }}>
            <a className="btn btn--secondary btn--small" href={api.CALENDAR_URL} download="exam-dates.ics">{t("rem.calendar")}</a>
          </div>
          <p className="small muted" style={{ marginTop: "var(--space-3)" }}>{t("rem.note")}</p>
        </>
      )}
    </section>
  );
}
