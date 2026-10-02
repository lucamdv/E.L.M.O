import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as contracts from "./index";

describe("standardized errors", () => {
  it("creates a serializable error with an explicit retry default", () => {
    expect(contracts.createElmoError?.("NOT_FOUND", "Missing capability")).toEqual({
      code: "NOT_FOUND", message: "Missing capability", retryable: false,
    });
  });

  it("preserves validated error metadata through propagation", () => {
    const error = { code: "PROVIDER_ERROR", message: "Busy", retryable: true, details: { providerId: "brain-1" } };
    expect(contracts.toElmoError?.(error)).toEqual(error);
  });

  it("defaults an explicitly undefined retry option", () => {
    expect(contracts.createElmoError("NOT_FOUND", "Missing", { retryable: undefined })).toEqual({
      code: "NOT_FOUND", message: "Missing", retryable: false,
    });
  });

  it.each([new Error("secret token"), "secret token", null])("sanitizes unknown failure %j", (error) => {
    expect(contracts.toElmoError?.(error)).toEqual({
      code: "INTERNAL_ERROR", message: "An unexpected error occurred", retryable: false,
    });
  });

  it("returns validated data on success", () => {
    expect(contracts.validateContract?.(z.strictObject({ count: z.number() }), { count: 2 })).toEqual({ ok: true, value: { count: 2 } });
  });

  it("returns serializable validation issues without raw input", () => {
    const result = contracts.validateContract?.(z.strictObject({ count: z.number() }), { count: "secret" });
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(contracts.ElmoErrorSchema?.safeParse(JSON.parse(JSON.stringify(result.error))).success).toBe(true);
      expect(JSON.stringify(result.error)).not.toContain("secret");
      expect(result.error.details).toMatchObject({ issues: [{ path: ["count"], code: "invalid_type" }] });
    }
  });

  it.each([
    { code: "anything", message: "Failure", retryable: false },
    { code: "NOT_FOUND", message: "", retryable: false },
    { code: "NOT_FOUND", message: "Failure", retryable: false, stack: "private" },
    { code: "NOT_FOUND", message: "Failure", retryable: false, details: { signal: new AbortController().signal } },
  ])("rejects invalid error envelope %j", (error) => {
    expect(contracts.ElmoErrorSchema?.safeParse(error).success).toBe(false);
  });
});
