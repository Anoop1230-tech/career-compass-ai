import { useState } from "react";
import { useI18n } from "../i18n";
import { TextField } from "./FormFields";
import { PASSWORD_HINT, passwordProblem } from "../profile/password";
import { changePassword, getErrorMessage } from "../services/api";

/** Change password card on the profile page. Other devices are signed out; this one stays logged in. */
export default function ChangePassword() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({}); // translation keys
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = {};
    if (!current) found.current = "password.currentMissing";
    const problem = passwordProblem(next);
    if (problem) found.next = problem;
    else if (next === current) found.next = "password.sameAsCurrent";
    else if (confirm !== next) found.confirm = "password.mismatch";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await changePassword(current, next);
      reset();
      setOpen(false);
      setDone(true);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const err = (name) => (errors[name] ? t(errors[name]) : undefined);

  return (
    <article className="card" style={{ marginTop: "var(--space-4)" }}>
      <h2 style={{ fontSize: "var(--text-lg)" }}>{t("password.cardTitle")}</h2>
      {done && <div className="notice" role="status">{t("password.changedOtherDevices")}</div>}
      {!open ? (
        <button type="button" className="btn btn--secondary btn--small" onClick={() => {
          setDone(false);
          setOpen(true);
        }}>
          {t("password.change")}
        </button>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="form" aria-label={t("password.change")}>
          {formError && <div className="notice notice--danger" role="alert">{formError}</div>}
          <TextField label={t("password.current")} type="password" autoComplete="current-password" required
            value={current} onChange={setCurrent} error={err("current")} />
          <TextField label={t("password.new")} type="password" autoComplete="new-password" required
            value={next} onChange={setNext} error={err("next")} hint={t(PASSWORD_HINT)} />
          <TextField label={t("password.repeat")} type="password" autoComplete="new-password" required
            value={confirm} onChange={setConfirm} error={err("confirm")} />
          <div className="btn-row">
            <button type="submit" className="btn btn--primary btn--small" disabled={submitting}>
              {submitting ? t("common.saving") : t("password.save")}
            </button>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => {
              reset();
              setOpen(false);
            }}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
