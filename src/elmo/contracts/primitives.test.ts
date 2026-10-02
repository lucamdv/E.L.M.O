import { describe, expect, it } from "vitest";
import * as contracts from "./index";

describe("shared schema primitives", () => {
  it("accepts a stable nonempty identifier", () => {
    expect(contracts.IdentifierSchema?.safeParse("turn-1").success).toBe(true);
  });

  it.each(["", " ", " padded ", "turn-1\n"])("rejects invalid identifier %j", (value) => {
    expect(contracts.IdentifierSchema?.safeParse(value).success).toBe(false);
  });

  it("accepts a timezone-qualified timestamp", () => {
    expect(contracts.TimestampSchema?.safeParse("2026-10-02T10:00:00-03:00").success).toBe(true);
  });

  it.each(["yesterday", "2026-10-02T10:00:00"])("rejects ambiguous timestamp %j", (value) => {
    expect(contracts.TimestampSchema?.safeParse(value).success).toBe(false);
  });

  it("accepts nested JSON data", () => {
    expect(contracts.JsonValueSchema?.safeParse({ values: [null, true, 1, "text"] }).success).toBe(true);
  });

  it.each([undefined, NaN, Infinity, () => 1, { nested: undefined }, new Date()])(
    "rejects non-serializable JSON value %j",
    (value) => {
      expect(contracts.JsonValueSchema?.safeParse(value).success).toBe(false);
    },
  );
});
