import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./api";

describe("getErrorMessage", () => {
  it("explains a timeout", () => {
    expect(getErrorMessage({ code: "ECONNABORTED" })).toMatch(/too long/);
  });

  it("explains a network failure (no response)", () => {
    expect(getErrorMessage({ message: "Network Error" })).toMatch(/Cannot reach the server/);
  });

  it("treats a plain proxy 5xx as backend down", () => {
    expect(getErrorMessage({ response: { status: 502, data: "" } })).toMatch(/Cannot reach the server/);
  });

  it("uses the API detail message", () => {
    const error = { response: { status: 503, data: { detail: "The database is unavailable." } } };
    expect(getErrorMessage(error)).toBe("The database is unavailable.");
  });

  it("falls back to the status code", () => {
    expect(getErrorMessage({ response: { status: 418, data: {} } })).toBe("Request failed (HTTP 418).");
  });

  it("never crashes on undefined", () => {
    expect(getErrorMessage(undefined)).toMatch(/Cannot reach the server/);
  });
});
