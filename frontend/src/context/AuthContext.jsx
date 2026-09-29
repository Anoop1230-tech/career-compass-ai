import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../services/api";

const AuthContext = createContext(null);

/**
 * Knows who is logged in. On load it asks the backend (/auth/me);
 * the httpOnly cookie is sent automatically by the browser.
 * status: "loading" | "authenticated" | "anonymous"
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  // true right after the user pressed "Log out" (protected pages then go home, not to /login)
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getCurrentUser()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        // 401 = not logged in; network errors also mean "treat as logged out"
        if (!active) return;
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const me = await api.loginUser(email, password);
    setUser(me);
    setStatus("authenticated");
    setLoggedOut(false);
    return me;
  }, []);

  const register = useCallback(async (email, password) => {
    const me = await api.registerUser(email, password);
    setUser(me);
    setStatus("authenticated");
    setLoggedOut(false);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logoutUser();
    } finally {
      // Even if the request fails, forget the user locally
      setUser(null);
      setStatus("anonymous");
      setLoggedOut(true);
    }
  }, []);

  const markProfileSaved = useCallback((hasProfile = true) => {
    setUser((current) => (current ? { ...current, has_profile: hasProfile } : current));
  }, []);

  const clearLoggedOut = useCallback(() => setLoggedOut(false), []);

  const value = useMemo(
    () => ({ user, status, loggedOut, login, register, logout, markProfileSaved, clearLoggedOut }),
    [user, status, loggedOut, login, register, logout, markProfileSaved, clearLoggedOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
