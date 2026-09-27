// Single Axios instance: every API call in the app goes through here,
// so the base URL, timeouts and (later) auth headers live in one place.
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  timeout: 5000,
});

export const getHealth = async () => {
  const response = await api.get("/health");
  return response.data;
};

export default api;
