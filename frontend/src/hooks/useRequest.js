import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../services/api";

/**
 * Runs an async loader and tracks loading / error / data.
 * - Re-runs when `deps` change; stale responses are ignored.
 * - `reload()` retries after an error.
 */
export default function useRequest(loader, deps) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading", error: null }));
    Promise.resolve()
      .then(() => loaderRef.current(controller.signal))
      .then((data) => active && setState({ status: "ready", data, error: null }))
      .catch((err) => {
        if (!active || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setState({ status: "error", data: null, error: getErrorMessage(err), raw: err });
      });
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
