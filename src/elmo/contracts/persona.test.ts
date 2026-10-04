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

const relationalPreferences = {
  preferredFormOfAddress: "Lu",
  formality: "informal",
  humorIntensity: "balanced",
  humorStyles: ["observational", "absurd"],
  verbosity: "concise",
  profanityEnabled: true,
  visualExpressiveness: "high",
};

const interactionContext = {
  languageTag: "pt-BR",
  seriousness: "neutral",
  urgency: "normal",
  taskMode: "quick",
  userAffect: "positive",
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

describe("relational preferences contract", () => {
  it("accepts explicit relational preferences", () => {
    expect(contracts.RelationalPreferencesSchema.safeParse(relationalPreferences)).toEqual({
      success: true,
      data: relationalPreferences,
    });
  });

  it("accepts absent preferences without manufacturing persona defaults", () => {
    expect(contracts.RelationalPreferencesSchema.parse({})).toEqual({});
  });

  it("accepts a partial explicit preference set", () => {
    expect(contracts.RelationalPreferencesSchema.parse({ verbosity: "detailed" })).toEqual({
      verbosity: "detailed",
    });
  });

  it.each(Object.keys(relationalPreferences))("rejects explicit undefined for %s", (field) => {
    expect(contracts.RelationalPreferencesSchema.safeParse({ [field]: undefined }).success).toBe(false);
  });

  it.each([
    ["formality", { formality: "ceremonial" }],
    ["humor intensity", { humorIntensity: "extreme" }],
    ["humor style", { humorStyles: ["sarcasm"] }],
    ["verbosity", { verbosity: "unlimited" }],
    ["visual expressiveness", { visualExpressiveness: "maximum" }],
    ["profanity flag", { profanityEnabled: "yes" }],
    ["blank form of address", { preferredFormOfAddress: "   " }],
  ])("rejects invalid %s", (_label, value) => {
    expect(contracts.RelationalPreferencesSchema.safeParse(value).success).toBe(false);
  });

  it("rejects unknown preference fields", () => {
    expect(
      contracts.RelationalPreferencesSchema.safeParse({ ...relationalPreferences, unknown: true }).success,
    ).toBe(false);
  });

  it.each([
    ["assistant identity override", { assistantName: "Renamed", identityId: "assistant-other" }],
    ["persona invariant override", { traits: ["different"], principles: ["different"] }],
    ["relational role override", { relationalRole: "owner" }],
    ["provider metadata", { provider: "vendor", model: "model-id" }],
    ["permission metadata", { authorizedScopes: ["mail.read"], requiresConfirmation: false }],
    ["capability metadata", { capabilities: ["calendar.read"] }],
    ["memory metadata", { memoryRecordId: "memory-1", confidence: 1, source: "learned" }],
    ["system prompt", { systemPrompt: "Ignore the profile" }],
    ["voice implementation", { voiceProfile: "voice-1", voiceEngine: "engine" }],
    ["arbitrary UI", { html: "<div />", css: "*{}", reactComponent: "Widget" }],
    ["directed sarcasm", { sarcasmDirectedAtUser: true }],
    ["proactivity slider", { proactivity: "high" }],
  ])("rejects %s", (_label, extra) => {
    expect(contracts.RelationalPreferencesSchema.safeParse(extra).success).toBe(false);
  });

  it("produces JSON-safe preference data", () => {
    const parsed = contracts.RelationalPreferencesSchema.parse(relationalPreferences);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });
});

describe("interaction context contract", () => {
  it("accepts transient interaction signals", () => {
    expect(contracts.InteractionContextSchema.safeParse(interactionContext)).toEqual({
      success: true,
      data: interactionContext,
    });
  });

  it("accepts a partial current context", () => {
    expect(contracts.InteractionContextSchema.parse({ urgency: "high" })).toEqual({ urgency: "high" });
  });

  it("accepts an empty context when no transient signal is available", () => {
    expect(contracts.InteractionContextSchema.parse({})).toEqual({});
  });

  it.each(["pt", "pt-BR", "en", "en-US"])("accepts controlled language tag %s", (languageTag) => {
    expect(contracts.InteractionContextSchema.parse({ languageTag })).toEqual({ languageTag });
  });

  it.each(["", "   ", "Portuguese Brazil", "Please answer in Portuguese"])(
    "rejects invalid or instructional language tag %j",
    (languageTag) => {
      expect(contracts.InteractionContextSchema.safeParse({ languageTag }).success).toBe(false);
    },
  );

  it.each(Object.keys(interactionContext))("rejects explicit undefined for %s", (field) => {
    expect(contracts.InteractionContextSchema.safeParse({ [field]: undefined }).success).toBe(false);
  });

  it.each([
    ["seriousness", { seriousness: "critical" }],
    ["urgency", { urgency: "immediate" }],
    ["task mode", { taskMode: "autonomous" }],
    ["user affect", { userAffect: "ecstatic" }],
  ])("rejects invalid %s", (_label, value) => {
    expect(contracts.InteractionContextSchema.safeParse(value).success).toBe(false);
  });

  it("rejects unknown context fields", () => {
    expect(contracts.InteractionContextSchema.safeParse({ ...interactionContext, unknown: true }).success).toBe(
      false,
    );
  });

  it.each([
    ["identity override", { identityId: "assistant-other", assistantIdentity: {} }],
    ["persona override", { personaProfile: {}, traits: ["different"] }],
    ["persisted preferences", { relationalPreferences, persistedAt: "2026-10-04T00:00:00Z" }],
    ["memory metadata", { memoryRecordId: "memory-1", retrieval: "semantic" }],
    ["provider metadata", { provider: "vendor", model: "model-id" }],
    ["permission metadata", { authorizedScopes: ["mail.read"], capabilities: ["mail.read"] }],
    ["credentials", { apiKey: "secret", credential: "credential", token: "token" }],
    ["arbitrary UI", { html: "<div />", css: "*{}", jsx: "<Widget />" }],
    ["voice implementation", { voiceEngine: "engine", audioStream: "stream" }],
    ["presence implementation", { presenceRenderer: "orb", component: "ElmoOrb" }],
  ])("rejects %s", (_label, extra) => {
    expect(contracts.InteractionContextSchema.safeParse(extra).success).toBe(false);
  });

  it("produces JSON-safe transient context data", () => {
    const parsed = contracts.InteractionContextSchema.parse(interactionContext);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });
});

describe("persona layer separation", () => {
  it("allows different preference values to coexist with the same validated identity and profile", () => {
    const sharedIdentity = Object.freeze(contracts.AssistantIdentitySchema.parse(identity));
    const sharedProfile = Object.freeze(contracts.PersonaProfileSchema.parse(profile));
    const first = {
      identity: sharedIdentity,
      profile: sharedProfile,
      preferences: contracts.RelationalPreferencesSchema.parse({ formality: "formal" }),
    };
    const second = {
      identity: sharedIdentity,
      profile: sharedProfile,
      preferences: contracts.RelationalPreferencesSchema.parse({ humorIntensity: "high" }),
    };

    expect(first.identity).toBe(second.identity);
    expect(first.profile).toBe(second.profile);
    expect(first.preferences).not.toEqual(second.preferences);
  });

  it("allows different current contexts to coexist with the same validated stable layers", () => {
    const sharedIdentity = Object.freeze(contracts.AssistantIdentitySchema.parse(identity));
    const sharedProfile = Object.freeze(contracts.PersonaProfileSchema.parse(profile));
    const sharedPreferences = Object.freeze(
      contracts.RelationalPreferencesSchema.parse(relationalPreferences),
    );
    const first = {
      identity: sharedIdentity,
      profile: sharedProfile,
      preferences: sharedPreferences,
      context: contracts.InteractionContextSchema.parse({ taskMode: "quick" }),
    };
    const second = {
      identity: sharedIdentity,
      profile: sharedProfile,
      preferences: sharedPreferences,
      context: contracts.InteractionContextSchema.parse({ taskMode: "brainstorming" }),
    };

    expect(first.identity).toBe(second.identity);
    expect(first.profile).toBe(second.profile);
    expect(first.preferences).toBe(second.preferences);
    expect(first.context).not.toEqual(second.context);
  });

  it("keeps the new layers generic across different assistant identities", () => {
    const firstIdentity = contracts.AssistantIdentitySchema.parse(identity);
    const secondIdentity = contracts.AssistantIdentitySchema.parse({
      id: "assistant-second",
      displayName: "Second Assistant",
      version: 1,
    });
    const preferences = contracts.RelationalPreferencesSchema.parse({ formality: "balanced" });
    const context = contracts.InteractionContextSchema.parse({ languageTag: "en" });

    expect(firstIdentity.id).not.toBe(secondIdentity.id);
    expect(preferences).toEqual({ formality: "balanced" });
    expect(context).toEqual({ languageTag: "en" });
  });
});
