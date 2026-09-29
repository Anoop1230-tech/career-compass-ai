import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { STEPS, stepForField, toFormState, toPayload, validateStep } from "../profile/profileForm";
import {
  BasicStep,
  EducationStep,
  ExperienceStep,
  InterestsStep,
  PreferencesStep,
  SkillsStep,
} from "../profile/ProfileSteps";
import * as api from "../services/api";

const STEP_COMPONENTS = {
  basic: BasicStep,
  education: EducationStep,
  skills: SkillsStep,
  experience: ExperienceStep,
  interests: InterestsStep,
  preferences: PreferencesStep,
};

/** Immutable update of a nested value: setIn(obj, "education.degree", "B.Tech") */
function setIn(obj, path, value) {
  const [head, ...rest] = path.split(".");
  return { ...obj, [head]: rest.length ? setIn(obj[head], rest.join("."), value) : value };
}

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { markProfileSaved } = useAuth();
  const headingRef = useRef(null);

  const [loadState, setLoadState] = useState({ status: "loading", error: "" });
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(() => toFormState(null));
  const [isNew, setIsNew] = useState(true);
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Load choice lists and the existing profile (404 = new profile)
  useEffect(() => {
    let active = true;
    Promise.all([
      api.getProfileOptions(),
      api.getProfile().catch((err) => {
        if (api.isNotFound(err)) return null;
        throw err;
      }),
    ])
      .then(([opts, profile]) => {
        if (!active) return;
        setOptions(opts);
        setForm(toFormState(profile));
        setIsNew(!profile);
        setLoadState({ status: "ready", error: "" });
      })
      .catch((err) => active && setLoadState({ status: "error", error: api.getErrorMessage(err) }));
    return () => {
      active = false;
    };
  }, [attempt]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((path, value) => {
    setForm((current) => setIn(current, path, value));
    setDirty(true);
    setErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }, []);

  const goTo = (index) => {
    setStep(index);
    setVisited((v) => new Set(v).add(index));
    setFormError("");
    // Move focus to the step heading so keyboard/screen-reader users know where they are
    requestAnimationFrame(() => headingRef.current?.focus());
    window.scrollTo(0, 0);
  };

  const checkStep = (index) => {
    const found = validateStep(STEPS[index].id, form);
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const next = () => {
    if (checkStep(step)) goTo(step + 1);
  };

  const save = async () => {
    if (saving) return;
    // Validate every step; jump to the first one with a problem
    for (let i = 0; i < STEPS.length; i += 1) {
      if (!checkStep(i)) {
        goTo(i);
        setFormError("Please fix the highlighted fields.");
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      await api.saveProfile(toPayload(form, options));
      markProfileSaved(true);
      setDirty(false);
      navigate("/dashboard", { replace: true, state: { profileJustSaved: true } });
    } catch (err) {
      if (api.isUnauthorized(err)) {
        navigate("/login", { state: { from: "/profile/edit" } });
        return;
      }
      const fieldErrors = api.getFieldErrors(err);
      setErrors(fieldErrors);
      const first = Object.keys(fieldErrors)[0];
      if (first) goTo(stepForField(first));
      setFormError(api.getErrorMessage(err));
      setSaving(false);
    }
  };

  if (loadState.status === "loading") {
    return (
      <div className="page-center" role="status" aria-label="Loading your profile">
        <div className="loader" />
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>Could not load your profile</h1>
          <p className="muted">{loadState.error}</p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={() => {
              setLoadState({ status: "loading", error: "" });
              setAttempt((n) => n + 1);
            }}>
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  const StepComponent = STEP_COMPONENTS[STEPS[step].id];
  const isLast = step === STEPS.length - 1;

  return (
    <section className="page">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="page__head">
          <div>
            <h1>{isNew ? "Create your profile" : "Edit your profile"}</h1>
            <p className="muted">
              Step {step + 1} of {STEPS.length}. Only name and stage are required; everything else improves your results.
            </p>
          </div>
          {!isNew && (
            <Link to="/profile" className="btn btn--ghost">
              Cancel
            </Link>
          )}
        </div>

        <nav aria-label="Profile steps">
          <ol className="stepper">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={i === step ? "step" : undefined}
                  className={i !== step && visited.has(i) ? "stepper__done" : undefined}
                  // Free navigation to earlier or visited steps; forward jumps validate the current step
                  onClick={() => (i <= step || visited.has(i) || checkStep(step) ? goTo(i) : undefined)}
                >
                  {i + 1}. {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {formError && (
          <div className="notice notice--danger" role="alert" style={{ marginBottom: "var(--space-5)" }}>
            {formError}
          </div>
        )}

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (isLast) save();
            else next();
          }}
        >
          <div ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            <StepComponent form={form} update={update} options={options} errors={errors} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--secondary" onClick={() => goTo(step - 1)} disabled={step === 0}>
              Back
            </button>
            <div className="btn-row">
              {!isLast && (
                <button type="button" className="btn btn--secondary" onClick={save} disabled={saving}>
                  Save now
                </button>
              )}
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? "Saving…" : isLast ? "Save profile" : "Continue"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
