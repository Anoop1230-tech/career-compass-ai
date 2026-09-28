import { useCallback, useEffect, useState } from "react";
import { getErrorMessage, getHealth } from "../services/api";

/**
 * Checks the backend health endpoint on mount and every `intervalMs`.
 * Returns { status: "checking" | "online" | "offline", error, retry }.
 */
export function useHealth(intervalMs = 30000) {
  const [state, setState] = useState({ status: "checking", error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true; // ignore results that arrive after unmount

    getHealth()
      .then(() => active && setState({ status: "online", error: "" }))
      .catch((err) => active && setState({ status: "offline", error: getErrorMessage(err) }));

    const timer = intervalMs > 0 ? setTimeout(() => setAttempt((n) => n + 1), intervalMs) : null;
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [attempt, intervalMs]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: "checking" }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
