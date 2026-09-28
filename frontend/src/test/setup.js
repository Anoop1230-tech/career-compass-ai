import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetStartRequests } from "../assessments/startRequests";

afterEach(() => {
  cleanup();
  resetStartRequests();
  vi.restoreAllMocks();
});

// jsdom does not implement scrollTo; Layout calls it on every page change
window.scrollTo = () => {};
