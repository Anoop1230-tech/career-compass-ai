import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { TextField } from "../components/FormFields";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, getFieldErrors } from "../services/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode, email, password) {
  const errors = {};
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
  if (mode === "register") {
    if (password.length < 8) errors.password = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      errors.password = "Include at least one letter and one number.";
  } else if (!password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

/** One component for both Log in and Create account. */
export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { status, user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in: skip this page
  if (status === "authenticated" && !submitting) {
    return <Navigate to={user?.has_profile ? "/profile" : "/profile/edit"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return; // ignore double clicks
    const found = validate(mode, email, password);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const me = isRegister ? await register(email.trim(), password) : await login(email.trim(), password);
      const from = location.state?.from;
      navigate(from && from !== "/login" ? from : me.has_profile ? "/profile" : "/profile/edit", { replace: true });
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card card">
        <h1>{isRegister ? "Create your account" : "Log in"}</h1>
        <p className="muted">
          {isRegister
            ? "Save your profile and get guidance based on where you are now."
            : "Welcome back. Continue where you left off."}
        </p>

        {formError && (
          <div className="notice notice--danger" role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="form">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
            error={errors.email}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            value={password}
            onChange={setPassword}
            error={errors.password}
            hint={isRegister ? "At least 8 characters, with a letter and a number." : undefined}
          />
          <label className="checkbox">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            <span>Show password</span>
          </label>

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? "Please wait…" : isRegister ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="auth__switch">
          {isRegister ? (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
