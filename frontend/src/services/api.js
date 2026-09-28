// Single Axios instance: every API call in the app goes through here,
// so the base URL, timeouts and (later) auth headers live in one place.
import axios from "axios";

// "/api" is relative: in development Vite proxies it to FastAPI,
// in production the same server (or a reverse proxy) serves it.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 8000,
  headers: { Accept: "application/json" },
});

/**
 * Turns any Axios error into one short, human-readable message,
 * so pages never show raw stack traces or "[object Object]".
 */
export function getErrorMessage(error) {
  if (error?.code === "ECONNABORTED") return "The server took too long to respond.";
  if (!error?.response) return "Cannot reach the server. Is the backend running?";
  const { status, data } = error.response;
  if (status >= 500 && (!data || typeof data !== "object")) {
    // Vite proxy returns a plain 5xx when FastAPI is down
    return "Cannot reach the server. Is the backend running?";
  }
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  return `Request failed (HTTP ${status}).`;
}

export const getHealth = async () => {
  const response = await api.get("/health");
  return response.data;
};

export default api;
