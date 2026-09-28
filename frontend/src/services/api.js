// Single Axios instance: every API call in the app goes through here,
// so the base URL, timeouts and error handling live in one place.
import axios from "axios";

// "/api" is relative: in development Vite proxies it to FastAPI,
// in production the same server (or a reverse proxy) serves it.
// The login cookie is httpOnly, so JavaScript never touches the token.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 8000,
  withCredentials: true,
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

/** Per-field messages from a 422 response: { "education.score": "..." } */
export function getFieldErrors(error) {
  const list = error?.response?.data?.errors;
  if (!Array.isArray(list)) return {};
  const result = {};
  for (const item of list) {
    if (item?.field && !result[item.field]) result[item.field] = item.message;
  }
  return result;
}

export const isUnauthorized = (error) => error?.response?.status === 401;
export const isNotFound = (error) => error?.response?.status === 404;

// ---- health
export const getHealth = async () => (await api.get("/health")).data;

// ---- auth
export const registerUser = async (email, password) =>
  (await api.post("/auth/register", { email, password })).data;
export const loginUser = async (email, password) => (await api.post("/auth/login", { email, password })).data;
export const logoutUser = async () => {
  await api.post("/auth/logout");
};
export const getCurrentUser = async () => (await api.get("/auth/me")).data;

// ---- profile
export const getProfileOptions = async () => (await api.get("/profile/options")).data;
export const getProfile = async () => (await api.get("/profile")).data;
export const saveProfile = async (profile) => (await api.put("/profile", profile)).data;
export const deleteProfile = async () => {
  await api.delete("/profile");
};

// ---- catalog (public reference data)
export const getCareers = async ({ q, domain, stage, limit = 50, offset = 0 } = {}, signal) =>
  (
    await api.get("/catalog/careers", {
      params: { q: q || undefined, domain: domain || undefined, stage: stage || undefined, limit, offset },
      signal,
    })
  ).data;
export const getCareer = async (careerId) =>
  (await api.get(`/catalog/careers/${encodeURIComponent(careerId)}`)).data;
export const getStages = async () => (await api.get("/catalog/stages")).data;

// ---- assessments (login required)
export const getAssessments = async () => (await api.get("/assessments")).data;
export const startAssessment = async (kind, restart = false) =>
  (await api.post(`/assessments/${kind}/start`, null, { params: restart ? { restart: true } : {} })).data;
export const submitAssessment = async (kind, attemptId, answers) =>
  (await api.post(`/assessments/${kind}/submit`, { attempt_id: attemptId, answers })).data;
export const getAssessmentResult = async (kind) => (await api.get(`/assessments/${kind}/result`)).data;

export default api;
