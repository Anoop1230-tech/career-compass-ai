import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { TextField } from "../components/FormFields";
import { PASSWORD_HINT, passwordProblem } from "../profile/password";
import { getErrorMessage, getFieldErrors, requestPasswordReset, confirmPasswordReset } from "../services/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Forgot password?": asks for the email and sends a reset link. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setSent(result.detail);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card card">
        <h1>Reset your password</h1>
        {sent ? (
          <>
            <div className="notice" role="status">{sent}</div>
            <p className="muted">The link works once and expires soon. Check your spam folder if you can't find it.</p>
          </>
        ) : (
          <>
            <p className="muted">Enter the email you signed up with and we'll send you a link to choose a new password.</p>
            {formError && <div className="notice notice--danger" role="alert">{formError}</div>}
            <form onSubmit={handleSubmit} noValidate className="form">
              <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={setEmail}
                error={error} />
              <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
                {submitting ? "Please wait…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <p className="auth__switch"><Link to="/login">Back to log in</Link></p>
      </div>
    </section>
  );
}

/** Opened from the email link: /reset-password#token=… (the fragment never reaches any server log). */
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.hash.replace(/^#/, "")).get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <section className="auth">
        <div className="auth__card card">
          <h1>Reset link missing</h1>
          <div className="notice notice--danger" role="alert">
            This page needs the link from your reset email. It may have been cut off when copying.
          </div>
          <p className="auth__switch"><Link to="/forgot-password">Request a new link</Link></p>
        </div>
      </section>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = {};
    const problem = passwordProblem(password);
    if (problem) found.password = problem;
    else if (confirm !== password) found.confirm = "The two passwords do not match.";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      const fields = getFieldErrors(err);
      setErrors(fields.new_password ? { password: fields.new_password } : {});
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card card">
        <h1>Choose a new password</h1>
        <p className="muted">You'll be signed out on every device and can then log in with the new password.</p>
        {formError && (
          <div className="notice notice--danger" role="alert">
            {formError} <Link to="/forgot-password">Request a new link</Link>
          </div>
        )}
        <form onSubmit={handleSubmit} noValidate className="form">
          <TextField label="New password" type="password" autoComplete="new-password" required value={password}
            onChange={setPassword} error={errors.password} hint={PASSWORD_HINT} />
          <TextField label="Repeat new password" type="password" autoComplete="new-password" required value={confirm}
            onChange={setConfirm} error={errors.confirm} />
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? "Please wait…" : "Save new password"}
          </button>
        </form>
      </div>
    </section>
  );
}
