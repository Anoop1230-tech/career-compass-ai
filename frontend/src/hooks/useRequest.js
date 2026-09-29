import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../services/api";

/**
 * Runs an async loader and tracks loading / error / data.
 * - Re-runs when `deps` change; stale responses are ignored.
 * - Data loaded for OTHER deps is never returned: right after deps change the
 *   hook reports "loading" immediately (not one render later), so pages never
 *   render old data with new inputs.
 * - `reload()` retries after an error.
 */
export default function useRequest(loader, deps) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  // Runs before the loading effect below (effects run in order), so it always uses the latest loader
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => loaderRef.current(controller.signal))
      .then((data) => active && setState({ key, status: "ready", data, error: null }))
      .catch((err) => {
        if (!active || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setState({ key, status: "error", data: null, error: getErrorMessage(err), raw: err });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, key: null }));
    setAttempt((n) => n + 1);
  }, []);
  if (state.key !== key) return { status: "loading", data: null, error: null, reload };
  return { ...state, reload };
}
