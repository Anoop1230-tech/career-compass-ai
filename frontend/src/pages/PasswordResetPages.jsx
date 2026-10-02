import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { TextField } from "../components/FormFields";
import { useI18n } from "../i18n";
import { PASSWORD_HINT, passwordProblem } from "../profile/password";
import { getErrorMessage, getFieldErrors, requestPasswordReset, confirmPasswordReset } from "../services/api";
import { EMAIL_PATTERN } from "./AuthPage";

/** "Forgot password?": asks for the email and sends a reset link. */
export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("auth.emailInvalid");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true); // the server's reply is the same for any email; show our translated version
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card card">
        <h1>{t("reset.forgot.title")}</h1>
        {sent ? (
          <>
            <div className="notice" role="status">{t("reset.forgot.sent")}</div>
            <p className="muted">{t("reset.forgot.sentHint")}</p>
          </>
        ) : (
          <>
            <p className="muted">{t("reset.forgot.lead")}</p>
            {formError && <div className="notice notice--danger" role="alert">{formError}</div>}
            <form onSubmit={handleSubmit} noValidate className="form">
              <TextField label={t("auth.email")} type="email" autoComplete="email" required value={email}
                onChange={setEmail} error={error ? t(error) : undefined} />
              <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
                {submitting ? t("common.pleaseWait") : t("reset.forgot.submit")}
              </button>
            </form>
          </>
        )}
        <p className="auth__switch"><Link to="/login">{t("reset.backToLogin")}</Link></p>
      </div>
    </section>
  );
}

/** Opened from the email link: /reset-password#token=… (the fragment never reaches any server log). */
export function ResetPasswordPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.hash.replace(/^#/, "")).get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({}); // translation keys, or server text in .server
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <section className="auth">
        <div className="auth__card card">
          <h1>{t("reset.missing.title")}</h1>
          <div className="notice notice--danger" role="alert">{t("reset.missing.text")}</div>
          <p className="auth__switch"><Link to="/forgot-password">{t("reset.requestNew")}</Link></p>
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
    else if (confirm !== password) found.confirm = "password.mismatch";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      const fields = getFieldErrors(err);
      setErrors(fields.new_password ? { server: fields.new_password } : {});
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card card">
        <h1>{t("reset.new.title")}</h1>
        <p className="muted">{t("reset.new.lead")}</p>
        {formError && (
          <div className="notice notice--danger" role="alert">
            {formError} <Link to="/forgot-password">{t("reset.requestNew")}</Link>
          </div>
        )}
        <form onSubmit={handleSubmit} noValidate className="form">
          <TextField label={t("password.new")} type="password" autoComplete="new-password" required value={password}
            onChange={setPassword} error={errors.server || (errors.password && t(errors.password))} hint={t(PASSWORD_HINT)} />
          <TextField label={t("password.repeat")} type="password" autoComplete="new-password" required value={confirm}
            onChange={setConfirm} error={errors.confirm && t(errors.confirm)} />
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? t("common.pleaseWait") : t("password.save")}
          </button>
        </form>
      </div>
    </section>
  );
}
