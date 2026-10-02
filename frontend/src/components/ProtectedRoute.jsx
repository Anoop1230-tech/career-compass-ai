import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";

/** Shows its children only to logged-in users; others go to /login. */
export default function ProtectedRoute({ children }) {
  const { status, loggedOut } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className="page-center" role="status" aria-label={t("auth.checkingSession")}>
        <div className="loader" />
      </div>
    );
  }

  if (status !== "authenticated") {
    // The user just pressed "Log out" on this page: take them home, not to a login form
    if (loggedOut) return <Navigate to="/" replace />;
    // Remember where the user wanted to go, and return there after login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
