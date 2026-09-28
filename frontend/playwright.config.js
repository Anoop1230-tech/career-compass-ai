import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the REAL backend and frontend, but on separate
// ports and a throwaway database, so they never touch your dev data or
// clash with servers you already have running.
const API_PORT = 8001;
const WEB_PORT = 5174;
const E2E_DB = join(tmpdir(), "career_compass_e2e.db");
// Fresh database every run. Playwright re-reads this file inside each test
// worker (TEST_WORKER_INDEX is set there), so only the main process deletes it.
if (!process.env.TEST_WORKER_INDEX) rmSync(E2E_DB, { force: true });

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `venv\\Scripts\\python.exe -m uvicorn app:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: `sqlite:///${E2E_DB.replaceAll("\\", "/")}`,
        ENVIRONMENT: "test",
        AUTH_RATE_LIMIT: "1000", // many sign-ups from one machine during tests
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
