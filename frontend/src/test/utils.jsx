// Shared helpers for component tests.
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import AppRoutes from "../AppRoutes";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../i18n";
import * as api from "../services/api";

export const OPTIONS = {
  stages: [
    { value: "class_10", label: "Class 10" },
    { value: "ug_student", label: "Undergraduate student" },
    { value: "working_professional", label: "Working professional" },
  ],
  school_stages: ["class_10", "class_11_12"],
  work_stages: ["working_professional"],
  streams: [{ value: "pcm", label: "Science – PCM" }],
  score_types: [
    { value: "percentage", label: "Percentage" },
    { value: "cgpa_10", label: "CGPA (out of 10)" },
  ],
  skill_categories: [{ value: "programming", label: "Programming" }, { value: "other", label: "Other" }],
  skill_levels: [{ value: "beginner", label: "Beginner" }, { value: "advanced", label: "Advanced" }],
  interests: [{ value: "technology", label: "Technology" }, { value: "law", label: "Law" }],
  goals: [{ value: "job", label: "Get a job" }],
  work_modes: [{ value: "any", label: "No preference" }, { value: "remote", label: "Remote" }],
};

export const USER = { id: 1, email: "asha@example.com", created_at: "2026-09-28T00:00:00Z", has_profile: false };

export const httpError = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

/** Mocks the API. `loggedIn` controls what /auth/me returns. */
export function mockApi({ loggedIn = false, user = USER, profile = null } = {}) {
  vi.spyOn(api, "getHealth").mockResolvedValue({ status: "ok", database: "connected" });
  vi.spyOn(api, "getCurrentUser").mockImplementation(() =>
    loggedIn ? Promise.resolve(user) : Promise.reject(httpError(401, { detail: "Please log in to continue." })),
  );
  vi.spyOn(api, "getProfileOptions").mockResolvedValue(OPTIONS);
  vi.spyOn(api, "getProfile").mockImplementation(() =>
    profile ? Promise.resolve(profile) : Promise.reject(httpError(404, { detail: "No profile" })),
  );
  vi.spyOn(api, "logoutUser").mockResolvedValue();
  // Dashboard data: no tests taken, no target career yet (tests can override)
  vi.spyOn(api, "getAssessments").mockResolvedValue([]);
  vi.spyOn(api, "getReminders").mockResolvedValue({ exams: [], events: [] });
  vi.spyOn(api, "getMyRoadmap").mockRejectedValue(httpError(404, { detail: "No target" }));
}

export function renderApp(path = "/", { lang = "en" } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider initial={lang}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}
