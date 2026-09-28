import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Shows its children only to logged-in users; others go to /login. */
export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="page-center" role="status" aria-label="Checking your session">
        <div className="loader" />
      </div>
    );
  }

  if (status !== "authenticated") {
    // Remember where the user wanted to go, and return there after login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
