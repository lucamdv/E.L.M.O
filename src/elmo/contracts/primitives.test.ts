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

  it.each(["object", "array", "indirect"])("rejects a cyclic %s JSON graph", (shape) => {
    const root: Record<string, unknown> = {};
    if (shape === "object") root.self = root;
    else if (shape === "array") {
      const list: unknown[] = [];
      list.push(list);
      root.list = list;
    } else root.child = { parent: root };
    expect(contracts.JsonValueSchema.safeParse(root).success).toBe(false);
    expect(contracts.JsonObjectSchema.safeParse(root).success).toBe(false);
  });

  it("accepts shared acyclic references in separate object and array branches", () => {
    const shared = { values: [1, "text", null] };
    const input = { first: shared, second: shared, list: [shared, shared] };
    const parsed = contracts.JsonValueSchema.parse(input);
    expect(parsed).toEqual({
      first: { values: [1, "text", null] }, second: { values: [1, "text", null] },
      list: [{ values: [1, "text", null] }, { values: [1, "text", null] }],
    });
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
    expect(contracts.JsonObjectSchema.safeParse(input).success).toBe(true);
  });

  it.each([undefined, NaN, Infinity, () => 1, { nested: undefined }, new Date()])(
    "rejects non-serializable JSON value %j",
    (value) => {
      expect(contracts.JsonValueSchema?.safeParse(value).success).toBe(false);
    },
  );
});
