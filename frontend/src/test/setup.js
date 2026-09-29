import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetStartRequests } from "../assessments/startRequests";

// findBy*/waitFor wait up to 1 s by default; with every file running in
// parallel a lazy page can take longer on a busy machine.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  resetStartRequests();
  vi.restoreAllMocks();
});

// jsdom does not implement scrollTo; Layout calls it on every page change
window.scrollTo = () => {};
