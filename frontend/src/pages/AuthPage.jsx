import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { TextField } from "../components/FormFields";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { getErrorMessage, getFieldErrors, getGoogleStatus, googleLoginUrl } from "../services/api";
import { PASSWORD_HINT, passwordProblem } from "../profile/password";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns translation keys per field. */
function validate(mode, email, password) {
  const errors = {};
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = "auth.emailInvalid";
  if (mode === "register") {
    const problem = passwordProblem(password);
    if (problem) errors.password = problem;
  } else if (!password) {
    errors.password = "auth.passwordMissing";
  }
  return errors;
}

const GOOGLE_ERRORS = ["cancelled", "expired", "unverified", "conflict", "failed"];

/** Google's "G" mark (inline, so the strict Content-Security-Policy needs no change). */
function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** One component for both Log in and Create account. */
export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { status, user, login, register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({}); // local: translation keys; from the server: ready text
  const [local, setLocal] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // The button only appears when the server has a Google client configured
  useEffect(() => {
    let active = true;
    getGoogleStatus()
      .then((data) => active && setGoogleEnabled(Boolean(data?.enabled)))
      .catch(() => active && setGoogleEnabled(false));
    return () => {
      active = false;
    };
  }, []);

  // The server sends people back here as /login?error=google_<reason> when Google sign-in fails
  const googleError = new URLSearchParams(location.search).get("error")?.replace(/^google_/, "");
  const googleErrorKey = googleError ? `auth.google.error.${GOOGLE_ERRORS.includes(googleError) ? googleError : "failed"}` : "";
  const from = location.state?.from;
  const googleNext = from && from !== "/login" && from !== "/register" ? from : "";

  // Already logged in: skip this page
  if (status === "authenticated" && !submitting) {
    return <Navigate to={user?.has_profile ? "/dashboard" : "/profile/quick"} replace />;
  }

  const fieldError = (name) => (errors[name] ? (local ? t(errors[name]) : errors[name]) : undefined);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return; // ignore double clicks
    const found = validate(mode, email, password);
    setErrors(found);
    setLocal(true);
    setFormError("");
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const me = isRegister ? await register(email.trim(), password) : await login(email.trim(), password);
      navigate(from && from !== "/login" ? from : me.has_profile ? "/dashboard" : "/profile/quick", { replace: true });
    } catch (error) {
      setErrors(getFieldErrors(error));
      setLocal(false);
      setFormError(getErrorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card card">
        <h1>{isRegister ? t("auth.register.title") : t("auth.login.title")}</h1>
        <p className="muted">{isRegister ? t("auth.register.lead") : t("auth.login.lead")}</p>

        {location.state?.passwordReset && !formError && (
          <div className="notice" role="status">{t("auth.passwordChanged")}</div>
        )}
        {(formError || googleErrorKey) && (
          <div className="notice notice--danger" role="alert">
            {formError || t(googleErrorKey)}
          </div>
        )}

        {googleEnabled && (
          <>
            <a className="btn btn--secondary btn--block btn--google" href={googleLoginUrl(googleNext)}>
              <GoogleMark />
              <span>{t("auth.google.continue")}</span>
            </a>
            <p className="auth__divider" aria-hidden="true">
              <span>{t("auth.google.or")}</span>
            </p>
          </>
        )}

        <form onSubmit={handleSubmit} noValidate className="form">
          <TextField
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
            error={fieldError("email")}
          />
          <TextField
            label={t("auth.password")}
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            value={password}
            onChange={setPassword}
            error={fieldError("password")}
            hint={isRegister ? t(PASSWORD_HINT) : undefined}
          />
          <label className="checkbox">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            <span>{t("auth.showPassword")}</span>
          </label>
          {!isRegister && (
            <p className="auth__forgot">
              <Link to="/forgot-password">{t("auth.forgot")}</Link>
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? t("common.pleaseWait") : isRegister ? t("auth.register.submit") : t("auth.login.submit")}
          </button>
        </form>

        <p className="auth__switch">
          {isRegister ? (
            <>
              {t("auth.haveAccount")} <Link to="/login">{t("auth.login.submit")}</Link>
            </>
          ) : (
            <>
              {t("auth.newHere")} <Link to="/register">{t("auth.createAccount")}</Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
