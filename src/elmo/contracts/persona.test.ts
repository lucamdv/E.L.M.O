import { describe, expect, it } from "vitest";
import * as contracts from "./index";

const identity = {
  id: "assistant-test",
  displayName: "Test Assistant",
  version: 1,
};

const profile = {
  identityId: identity.id,
  version: 1,
  traits: ["empathetic", "curious"],
  relationalRole: "trusted partner",
  communicationDefaults: ["clear", "warm"],
  behaviorDefaults: ["proactive when useful", "concise by default"],
  principles: ["never fabricate certainty"],
};

describe("assistant identity contract", () => {
  it("accepts a minimal stable identity", () => {
    expect(contracts.AssistantIdentitySchema.safeParse(identity)).toEqual({
      success: true,
      data: identity,
    });
  });

  it.each(["", " ", "assistant identity"])("rejects invalid identity id %j", (id) => {
    expect(contracts.AssistantIdentitySchema.safeParse({ ...identity, id }).success).toBe(false);
  });

  it.each(["", "   "])("rejects empty display name %j", (displayName) => {
    expect(contracts.AssistantIdentitySchema.safeParse({ ...identity, displayName }).success).toBe(false);
  });

  it.each([0, -1, 1.5])("rejects invalid identity version %j", (version) => {
    expect(contracts.AssistantIdentitySchema.safeParse({ ...identity, version }).success).toBe(false);
  });

  it("rejects unknown identity fields", () => {
    expect(contracts.AssistantIdentitySchema.safeParse({ ...identity, unknown: true }).success).toBe(false);
  });

  it("accepts different identities through the same generic schema", () => {
    const first = contracts.AssistantIdentitySchema.parse(identity);
    const second = contracts.AssistantIdentitySchema.parse({
      id: "assistant-second",
      displayName: "Second Assistant",
      version: 3,
    });

    expect(first.id).toBe("assistant-test");
    expect(second.id).toBe("assistant-second");
  });

  it.each([
    ["provider metadata", { provider: "vendor", model: "model-id" }],
    ["permission metadata", { authorizedScopes: ["mail.read"], requiresConfirmation: false }],
    ["capability metadata", { capabilities: ["calendar.read"] }],
  ])("rejects %s", (_label, extra) => {
    expect(contracts.AssistantIdentitySchema.safeParse({ ...identity, ...extra }).success).toBe(false);
  });
});

describe("persona profile contract", () => {
  it("accepts a minimal structured profile", () => {
    expect(contracts.PersonaProfileSchema.safeParse(profile)).toEqual({
      success: true,
      data: profile,
    });
  });

  it.each([0, -1, 1.5])("rejects invalid profile version %j", (version) => {
    expect(contracts.PersonaProfileSchema.safeParse({ ...profile, version }).success).toBe(false);
  });

  it.each([
    ["traits", []],
    ["communicationDefaults", []],
    ["behaviorDefaults", []],
    ["principles", []],
  ])("requires nonempty structured %s", (field, value) => {
    expect(contracts.PersonaProfileSchema.safeParse({ ...profile, [field]: value }).success).toBe(false);
  });

  it.each(["traits", "communicationDefaults", "behaviorDefaults", "principles"])(
    "rejects blank entries in %s",
    (field) => {
      expect(contracts.PersonaProfileSchema.safeParse({ ...profile, [field]: [" "] }).success).toBe(false);
    },
  );

  it("rejects an empty relational role", () => {
    expect(contracts.PersonaProfileSchema.safeParse({ ...profile, relationalRole: " " }).success).toBe(false);
  });

  it("rejects unknown profile fields", () => {
    expect(contracts.PersonaProfileSchema.safeParse({ ...profile, unknown: true }).success).toBe(false);
  });

  it.each([
    ["provider metadata", { provider: "vendor", model: "model-id" }],
    ["system prompt blob", { systemPrompt: "Act as this assistant" }],
    ["permission metadata", { scopes: ["mail.read"], allow: true }],
    ["capability metadata", { capabilities: ["calendar.read"] }],
    ["memory metadata", { memoryRecordId: "memory-1", retrieval: "semantic" }],
  ])("rejects %s", (_label, extra) => {
    expect(contracts.PersonaProfileSchema.safeParse({ ...profile, ...extra }).success).toBe(false);
  });

  it("produces JSON-safe data without non-JSON fields", () => {
    const parsed = contracts.PersonaProfileSchema.parse(profile);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });
});
