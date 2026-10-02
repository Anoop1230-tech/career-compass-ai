import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import * as api from "../services/api";

const LEVELS = ["beginner", "intermediate", "advanced"];
const MAX_BYTES = 2 * 1024 * 1024;

/** Upload a PDF résumé, review the skills found, add only the ones the user confirms. */
export default function ResumePage() {
  const { t } = useI18n();
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ status: "idle" });
  const [picked, setPicked] = useState({}); // skill_id -> level, only for ticked skills

  const read = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) { setState({ status: "error", message: t("err.resume.too_large") }); return; }
    setState({ status: "loading" });
    try {
      const data = await api.readResumeSkills(file);
      setPicked(Object.fromEntries(data.skills.filter((s) => !s.in_profile).map((s) => [s.skill_id, "beginner"])));
      setState({ status: "done", data });
    } catch (err) {
      setState({ status: "error", message: api.getErrorMessage(err) });
    }
  };

  const add = async () => {
    const chosen = state.data.skills.filter((s) => picked[s.skill_id]);
    setState({ ...state, saving: true, message: "" });
    try {
      // eslint-disable-next-line no-unused-vars
      const { updated_at, ...profile } = await api.getProfile();
      const have = new Set((profile.skills || []).map((s) => s.name.toLowerCase()));
      const extra = chosen.filter((s) => !have.has(s.name.toLowerCase()))
        .map((s) => ({ name: s.name, category: s.category, level: picked[s.skill_id] }));
      await api.saveProfile({ ...profile, skills: [...(profile.skills || []), ...extra].slice(0, 100) });
      setState({ status: "saved", count: extra.length });
    } catch (err) {
      setState({ ...state, saving: false, message: api.getErrorMessage(err) });
    }
  };

  const d = state.data;
  const count = Object.keys(picked).length;
  return (
    <section className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page__head">
          <div>
            <h1>{t("resume.title")}</h1>
            <p className="muted">{t("resume.lead")}</p>
          </div>
        </div>

        {state.status === "saved" ? (
          <div className="notice" role="status">
            <p>{t("resume.added", { n: state.count })}</p>
            <Link to="/profile" className="btn btn--primary">{t("resume.backProfile")}</Link>
          </div>
        ) : (
          <form className="card" onSubmit={read}>
            <div className="field">
              <label className="field__label" htmlFor="resume-file">{t("resume.file")}</label>
              <input id="resume-file" className="input" type="file" accept="application/pdf,.pdf" aria-describedby="resume-privacy"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setState({ status: "idle" }); }} />
              <p id="resume-privacy" className="small muted">{t("resume.privacy")}</p>
            </div>
            <button type="submit" className="btn btn--primary" disabled={!file || state.status === "loading"}>
              {state.status === "loading" ? t("resume.reading") : t("resume.read")}
            </button>
          </form>
        )}

        {state.status === "error" && <p className="notice notice--error" role="alert" style={{ marginTop: "var(--space-4)" }}>{state.message}</p>}

        {state.status === "done" && d && (
          <div style={{ marginTop: "var(--space-5)" }}>
            {d.skills.length === 0 ? <p className="notice" role="status">{t("resume.none")}</p> : (
              <>
                <p role="status">{t("resume.found", { n: d.skills.length, pages: d.pages })}</p>
                <ul className="plain-list" style={{ listStyle: "none", paddingLeft: 0 }}>
                  {d.skills.map((s) => (
                    <li key={s.skill_id} className="btn-row" style={{ alignItems: "center" }}>
                      <label className="radio-inline">
                        <input type="checkbox" disabled={s.in_profile} checked={Boolean(picked[s.skill_id])}
                          onChange={(e) => setPicked((p) => {
                            const next = { ...p };
                            if (e.target.checked) next[s.skill_id] = "beginner";
                            else delete next[s.skill_id];
                            return next;
                          })} />
                        {s.name}
                      </label>
                      {s.in_profile ? <span className="muted small">{t("resume.inProfile")}</span> : picked[s.skill_id] && (
                        <select className="input" style={{ width: "auto" }} aria-label={t("resume.level", { name: s.name })}
                          value={picked[s.skill_id]} onChange={(e) => setPicked((p) => ({ ...p, [s.skill_id]: e.target.value }))}>
                          {LEVELS.map((l) => <option key={l} value={l}>{t(`opt.skill_levels.${l}`)}</option>)}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
                {d.has_profile ? (
                  <button type="button" className="btn btn--primary" style={{ marginTop: "var(--space-4)" }}
                    disabled={count === 0 || state.saving} onClick={add}>{t("resume.add", { n: count })}</button>
                ) : (
                  <p className="notice">{t("resume.needProfile")} <Link to="/profile/edit">{t("profile.editButton")}</Link></p>
                )}
                {state.message && <p className="notice notice--error" role="alert">{state.message}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
