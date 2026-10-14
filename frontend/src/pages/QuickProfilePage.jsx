import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChipGroup, SelectField, TextField } from "../components/FormFields";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { isWorkStage, stageKind, toFormState, toPayload } from "../profile/profileForm";
import * as api from "../services/api";

// Suggestions only: the user can type anything. Texts match what engine/context.py recognises.
const DEGREES = ["B.Tech", "B.E.", "BCA", "B.Sc", "B.Com", "BA", "MBBS", "B.Pharm", "B.Sc Nursing", "LLB", "M.Tech",
  "MBA", "MCA", "M.Sc", "MS", "PhD"];
const BRANCHES = ["Computer Science", "Information Technology", "AI and Data Science", "Electronics and Communication",
  "Electrical", "Mechanical", "Civil", "Chemical", "Aerospace", "Automobile", "Production", "Mechatronics",
  "Instrumentation", "Biotechnology", "Biomedical", "Metallurgy", "Mining", "Petroleum", "Marine", "Textile",
  "Environmental", "Agricultural", "Mathematics", "Statistics", "Physics", "Commerce", "History", "English"];
const MAX_INTERESTS = 5;

/**
 * A 60-second profile: name, stage, stream or degree + branch, and up to 5 interests.
 * Saving shows careers straight away; everything else can be added later in the full form.
 * An existing profile keeps all its other details (skills, experience …).
 */
export default function QuickProfilePage() {
  const navigate = useNavigate();
  const { markProfileSaved } = useAuth();
  const { t, tOptions } = useI18n();
  const [state, setState] = useState({ status: "loading" });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getProfileOptions(),
      api.getProfile().catch((err) => (api.isNotFound(err) ? null : Promise.reject(err))),
    ])
      .then(async ([options, profile]) => {
        const f = toFormState(profile);
        if (!profile) {
          const hints = await api.getProfileHints().catch(() => ({}));
          if (hints?.full_name?.value) f.full_name = hints.full_name.value;
          if (hints?.institution?.value) f.education.institution = hints.institution.value;
        }
        if (!active) return;
        setForm(f);
        setState({ status: "ready", options });
      })
      .catch((err) => active && setState({ status: "error", error: api.getErrorMessage(err) }));
    return () => { active = false; };
  }, []);

  if (state.status === "loading") {
    return <div className="page-center" role="status" aria-label={t("profile.loading")}><div className="loader" /></div>;
  }
  if (state.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>{t("profile.loadError")}</h1>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>{t("common.tryAgain")}</button>
        </div>
      </section>
    );
  }

  const options = state.options;
  const o = tOptions(options);
  const kind = stageKind(form.current_stage, options);
  const set = (path, value) => {
    setForm((f) => {
      const [a, b] = path.split(".");
      return b ? { ...f, [a]: { ...f[a], [b]: value } } : { ...f, [a]: value };
    });
    setErrors((e) => ({ ...e, [path]: undefined }));
  };

  const save = async (event) => {
    event.preventDefault();
    const found = {};
    if (form.full_name.trim().length < 2) found.full_name = t("quick.err.name");
    if (!form.current_stage) found.current_stage = t("quick.err.stage");
    if (form.interests.length > MAX_INTERESTS) found.interests = t("quick.err.interests", { n: MAX_INTERESTS });
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError(t("profile.fixFields"));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api.saveProfile(toPayload(form, options));
      markProfileSaved(true);
      navigate("/for-you", { replace: true, state: { profileJustSaved: true } });
    } catch (err) {
      if (api.isUnauthorized(err)) {
        navigate("/login", { state: { from: "/profile/quick" } });
        return;
      }
      setErrors(api.getFieldErrors(err));
      setFormError(api.getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <section className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page__head">
          <div>
            <h1>{t("quick.title")}</h1>
            <p className="muted">{t("quick.lead")}</p>
          </div>
        </div>

        {formError && <div className="notice notice--danger" role="alert" style={{ marginBottom: "var(--space-5)" }}>{formError}</div>}

        <form noValidate onSubmit={save} className="card">
          <div className="form-grid">
            <TextField label={t("profile.f.fullName")} required autoComplete="name" value={form.full_name}
              onChange={(v) => set("full_name", v)} error={errors.full_name} maxLength={100} />
            <SelectField label={t("profile.f.stage")} required value={form.current_stage}
              onChange={(v) => set("current_stage", v)} options={o.stages}
              placeholder={t("profile.f.stage.placeholder")} error={errors.current_stage} />
          </div>

          {kind === "school" && (
            <SelectField label={t("profile.f.stream")} value={form.education.stream} onChange={(v) => set("education.stream", v)}
              options={o.streams} hint={t("profile.f.stream.hint")} error={errors["education.stream"]} />
          )}
          {kind === "higher" && !isWorkStage(form.current_stage, options) && (
            <div className="form-grid">
              {form.current_stage !== "diploma" && (
                <TextField label={t("profile.f.degree")} hint={t("quick.degreeHint")} list="quick-degrees"
                  value={form.education.degree} onChange={(v) => set("education.degree", v)}
                  error={errors["education.degree"]} maxLength={100} />
              )}
              <TextField label={t("profile.f.branch")} hint={t("quick.branchHint")} list="quick-branches"
                value={form.education.branch} onChange={(v) => set("education.branch", v)}
                error={errors["education.branch"]} maxLength={100} />
            </div>
          )}
          {isWorkStage(form.current_stage, options) && (
            <TextField label={t("profile.f.currentRole")} value={form.experience.current_role}
              onChange={(v) => set("experience.current_role", v)} error={errors["experience.current_role"]} maxLength={100} />
          )}
          <datalist id="quick-degrees">{DEGREES.map((d) => <option key={d} value={d} />)}</datalist>
          <datalist id="quick-branches">{BRANCHES.map((b) => <option key={b} value={b} />)}</datalist>

          <ChipGroup legend={t("quick.interests")} hint={t("quick.interestsHint", { n: MAX_INTERESTS })} options={o.interests}
            values={form.interests} onChange={(v) => set("interests", v)} error={errors.interests} />

          <div className="form-actions">
            <Link to="/profile/edit" className="btn btn--ghost">{t("quick.fullForm")}</Link>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t("common.saving") : t("quick.save")}
            </button>
          </div>
        </form>
        <p className="small muted" style={{ marginTop: "var(--space-4)" }}>{t("quick.later")}</p>
      </div>
    </section>
  );
}
