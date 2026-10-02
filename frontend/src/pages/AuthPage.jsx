import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { TextField } from "../components/FormFields";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { getErrorMessage, getFieldErrors } from "../services/api";
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

  // Already logged in: skip this page
  if (status === "authenticated" && !submitting) {
    return <Navigate to={user?.has_profile ? "/dashboard" : "/profile/edit"} replace />;
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
      const from = location.state?.from;
      navigate(from && from !== "/login" ? from : me.has_profile ? "/dashboard" : "/profile/edit", { replace: true });
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
        {formError && (
          <div className="notice notice--danger" role="alert">
            {formError}
          </div>
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
