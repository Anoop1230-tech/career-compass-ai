import { useState } from "react";
import { TextField } from "./FormFields";
import { PASSWORD_HINT, passwordProblem } from "../profile/password";
import { changePassword, getErrorMessage } from "../services/api";

/** Change password card on the profile page. Other devices are signed out; this one stays logged in. */
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
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
    if (!current) found.current = "Enter your current password.";
    const problem = passwordProblem(next);
    if (problem) found.next = problem;
    else if (next === current) found.next = "Choose a password different from the current one.";
    else if (confirm !== next) found.confirm = "The two passwords do not match.";
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

  return (
    <article className="card" style={{ marginTop: "var(--space-4)" }}>
      <h2 style={{ fontSize: "var(--text-lg)" }}>Password</h2>
      {done && (
        <div className="notice" role="status">
          Password changed. You were signed out on your other devices.
        </div>
      )}
      {!open ? (
        <button type="button" className="btn btn--secondary btn--small" onClick={() => {
          setDone(false);
          setOpen(true);
        }}>
          Change password
        </button>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="form" aria-label="Change password">
          {formError && <div className="notice notice--danger" role="alert">{formError}</div>}
          <TextField label="Current password" type="password" autoComplete="current-password" required
            value={current} onChange={setCurrent} error={errors.current} />
          <TextField label="New password" type="password" autoComplete="new-password" required
            value={next} onChange={setNext} error={errors.next} hint={PASSWORD_HINT} />
          <TextField label="Repeat new password" type="password" autoComplete="new-password" required
            value={confirm} onChange={setConfirm} error={errors.confirm} />
          <div className="btn-row">
            <button type="submit" className="btn btn--primary btn--small" disabled={submitting}>
              {submitting ? "Saving…" : "Save new password"}
            </button>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => {
              reset();
              setOpen(false);
            }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
