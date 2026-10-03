import { describe, expect, it } from "vitest";
import { AutomationDefinitionSchema } from "../../src/elmo/contracts/automation";

function definition() {
  return {
    id: "automation-1",
    trigger: { type: "test.trigger", config: { at: "09:00", enabled: true } },
    action: { capabilityId: "test.capability", input: { values: [null, 3, "Pause"] } },
    delivery: { type: "test.inbox", config: {} },
  };
}

// Characterization of existing schemas: these tests add no engine or execution policy.
describe("AutomationDefinition foundation", () => {
  it.each([false, true])("round-trips declarative JSON with optional condition present=%s", (withCondition) => {
    const input = withCondition
      ? { ...definition(), condition: { type: "test.condition", config: { state: "available" } } }
      : definition();
    const parsed = AutomationDefinitionSchema.parse(JSON.parse(JSON.stringify(input)));
    expect(parsed).toEqual(input);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(input);
  });

  it.each(["root", "trigger", "condition", "action", "delivery"])("rejects unknown fields on the %s envelope", (field) => {
    const input = { ...definition(), condition: { type: "test.condition", config: {} } };
    const malformed = field === "root"
      ? { ...input, execute: "unexpected" }
      : { ...input, [field]: { ...input[field as keyof typeof input] as object, unexpected: true } };
    expect(AutomationDefinitionSchema.safeParse(malformed).success).toBe(false);
  });

  const nonJson = [
    { name: "function", value: () => {} }, { name: "undefined", value: undefined },
    { name: "bigint", value: BigInt(1) }, { name: "symbol", value: Symbol("private") },
    { name: "NaN", value: NaN }, { name: "Infinity", value: Infinity },
    { name: "Date", value: new Date("2026-10-03T12:00:00Z") },
    { name: "Map", value: new Map([["private", "value"]]) },
    { name: "AbortSignal", value: new AbortController().signal },
  ];

  for (const field of ["trigger", "condition", "action", "delivery"] as const) {
    it.each(nonJson)(`rejects non-JSON $name nested in ${field}`, ({ value }) => {
      const input = { ...definition(), condition: { type: "test.condition", config: {} } };
      const envelope = field === "action"
        ? { ...input.action, input: { nested: [value] } }
        : { ...input[field], config: { nested: [value] } };
      expect(AutomationDefinitionSchema.safeParse({ ...input, [field]: envelope }).success).toBe(false);
    });
  }

  it("rejects executable callbacks without invoking them", () => {
    let calls = 0;
    const execute = () => { calls++; return "private result"; };
    expect(AutomationDefinitionSchema.safeParse({ ...definition(), execute }).success).toBe(false);
    expect(AutomationDefinitionSchema.safeParse({
      ...definition(), action: { capabilityId: "test.capability", input: { execute } },
    }).success).toBe(false);
    expect(calls).toBe(0);
  });

  it.each(["trigger", "condition", "action", "delivery"] as const)("rejects a cyclic JSON graph in %s", (field) => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const input = { ...definition(), condition: { type: "test.condition", config: {} } };
    const envelope = field === "action"
      ? { ...input.action, input: cycle }
      : { ...input[field], config: { nested: cycle } };
    expect(AutomationDefinitionSchema.safeParse({ ...input, [field]: envelope }).success).toBe(false);
  });

  it.each(["id", "trigger", "action", "delivery"])("requires the %s field", (field) => {
    const input: Record<string, unknown> = definition();
    delete input[field];
    expect(AutomationDefinitionSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { id: "" }, { trigger: { type: "invalid type", config: {} } },
    { condition: { type: "", config: {} } }, { action: { capabilityId: "", input: null } },
    { delivery: { type: "", config: {} } },
    { trigger: { type: "test", config: [] } }, { delivery: { type: "test", config: "invalid" } },
  ])("rejects malformed declarative fields %j", (override) => {
    expect(AutomationDefinitionSchema.safeParse({ ...definition(), ...override }).success).toBe(false);
  });
});
