import { describe, expect, it } from "vitest";
import {
  BehavioralContextSchema,
  JsonObjectSchema,
  type AssistantIdentity,
  type InteractionContext,
  type PersonaProfile,
  type RelationalPreferences,
} from "../contracts";
import { composePersonaContext } from "./persona-composer";

const identity = {
  id: "assistant-test",
  displayName: "Test Assistant",
  version: 1,
};

const personaProfile = {
  identityId: identity.id,
  version: 1,
  traits: ["empathetic", "curious"],
  relationalRole: "trusted partner",
  communicationDefaults: ["clear", "warm"],
  behaviorDefaults: ["concise by default"],
  principles: ["never fabricate certainty"],
};

type CompositionFixture = {
  identity: AssistantIdentity;
  personaProfile: PersonaProfile;
  relationalPreferences: RelationalPreferences;
  interactionContext: InteractionContext;
};

function input(overrides: Record<string, unknown> = {}): CompositionFixture {
  return {
    identity: structuredClone(identity),
    personaProfile: structuredClone(personaProfile),
    relationalPreferences: {},
    interactionContext: {},
    ...overrides,
  } as CompositionFixture;
}

function expectComposed(value: unknown) {
  const result = composePersonaContext(value);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected composition to succeed");
  return result.value;
}

describe("composePersonaContext", () => {
  it("composes matching stable layers with empty relational and current context", () => {
    expect(composePersonaContext(input())).toEqual({
      ok: true,
      value: {
        identity,
        personaProfile,
        relationalPreferences: {},
        interactionContext: {},
      },
    });
  });

  it("rejects an identity/profile mismatch through the controlled contract boundary", () => {
    const result = composePersonaContext(input({
      personaProfile: { ...personaProfile, identityId: "assistant-other" },
    }));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
    expect(() => composePersonaContext(input({
      personaProfile: { ...personaProfile, identityId: "assistant-other" },
    }))).not.toThrow();
  });

  it("returns the same structured result for the same input", () => {
    const value = input({
      relationalPreferences: { formality: "balanced", verbosity: "concise" },
      interactionContext: { languageTag: "pt-BR", taskMode: "quick" },
    });

    expect(composePersonaContext(value)).toEqual(composePersonaContext(value));
  });

  it("produces a BehavioralContext that is valid JSON object data", () => {
    const value = expectComposed(input({
      relationalPreferences: { humorStyles: ["observational"] },
      interactionContext: { urgency: "high" },
    }));

    expect(BehavioralContextSchema.safeParse(value).success).toBe(true);
    expect(JsonObjectSchema.safeParse(value).success).toBe(true);
    expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  });

  it("does not mutate inputs and returns an independent snapshot", () => {
    const source = input({
      relationalPreferences: { formality: "formal" },
      interactionContext: { seriousness: "serious" },
    });
    const before = structuredClone(source);
    const value = expectComposed(source);

    expect(source).toEqual(before);

    source.identity.displayName = "Changed";
    source.personaProfile.traits.push("changed");
    source.relationalPreferences.formality = "informal";
    source.interactionContext.seriousness = "casual";

    expect(value).toEqual(before);
  });

  it("does not manufacture relational defaults or current signals", () => {
    const value = expectComposed(input());

    expect(value.relationalPreferences).toEqual({});
    expect(value.interactionContext).toEqual({});
  });

  it("varies only the relational layer for different explicit preferences", () => {
    const formal = expectComposed(input({
      relationalPreferences: { preferredFormOfAddress: "Dr. Vale", formality: "formal" },
    }));
    const informal = expectComposed(input({
      relationalPreferences: { preferredFormOfAddress: "Vale", formality: "informal" },
    }));

    expect(formal.identity).toEqual(informal.identity);
    expect(formal.personaProfile).toEqual(informal.personaProfile);
    expect(formal.interactionContext).toEqual(informal.interactionContext);
    expect(formal.relationalPreferences).not.toEqual(informal.relationalPreferences);
  });

  it("keeps identity and persona invariants outside relational adaptation", () => {
    const value = expectComposed(input({
      relationalPreferences: { preferredFormOfAddress: "Boss", humorIntensity: "high" },
    }));

    expect(value.identity.displayName).toBe("Test Assistant");
    expect(value.personaProfile.traits).toEqual(personaProfile.traits);
    expect(value.personaProfile.principles).toEqual(personaProfile.principles);
  });

  it("varies only current context for different transient signals", () => {
    const quick = expectComposed(input({
      relationalPreferences: { verbosity: "balanced" },
      interactionContext: { taskMode: "quick", urgency: "high" },
    }));
    const brainstorming = expectComposed(input({
      relationalPreferences: { verbosity: "balanced" },
      interactionContext: { taskMode: "brainstorming", urgency: "normal" },
    }));

    expect(quick.identity).toEqual(brainstorming.identity);
    expect(quick.personaProfile).toEqual(brainstorming.personaProfile);
    expect(quick.relationalPreferences).toEqual(brainstorming.relationalPreferences);
    expect(quick.interactionContext).not.toEqual(brainstorming.interactionContext);
  });

  it("keeps transient context out of the stable identity and profile layers", () => {
    const value = expectComposed(input({
      interactionContext: { languageTag: "en-US", userAffect: "frustrated" },
    }));

    expect(value.identity).toEqual(identity);
    expect(value.personaProfile).toEqual(personaProfile);
    expect(value.identity).not.toHaveProperty("interactionContext");
    expect(value.personaProfile).not.toHaveProperty("interactionContext");
  });

  it("uses the same composer for a second generic assistant identity", () => {
    const secondIdentity = {
      id: "assistant-second",
      displayName: "Second Assistant",
      version: 2,
    };
    const secondProfile = {
      ...personaProfile,
      identityId: secondIdentity.id,
      version: 2,
      traits: ["analytical"],
    };

    const value = expectComposed(input({
      identity: secondIdentity,
      personaProfile: secondProfile,
    }));

    expect(value.identity).toEqual(secondIdentity);
    expect(value.personaProfile).toEqual(secondProfile);
  });

  it.each([
    ["missing layer", { identity, personaProfile, relationalPreferences: {} }],
    ["unknown outer field", { ...input(), unknown: true }],
    ["invalid identity", input({ identity: { ...identity, id: "bad id" } })],
    ["invalid preferences", input({ relationalPreferences: { verbosity: "unbounded" } })],
    ["invalid current context", input({ interactionContext: { languageTag: "Answer in English" } })],
    ["non-JSON value", input({ interactionContext: { urgency: () => "high" } })],
  ])("normalizes invalid composition input: %s", (_label, value) => {
    expect(composePersonaContext(value)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
  });

  it("normalizes exceptions raised while reading hostile input", () => {
    const hostile = input();
    Object.defineProperty(hostile, "identity", {
      enumerable: true,
      get() {
        throw new Error("private getter detail");
      },
    });

    expect(composePersonaContext(hostile)).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryable: false,
      },
    });
  });

  it("exposes only the four domain layers without prompt, brain, authority, capability, or rendering fields", () => {
    const value = expectComposed(input({
      relationalPreferences: { visualExpressiveness: "balanced" },
      interactionContext: { userAffect: "positive" },
    }));

    expect(Object.keys(value)).toEqual([
      "identity",
      "personaProfile",
      "relationalPreferences",
      "interactionContext",
    ]);
    for (const field of [
      "systemPrompt",
      "messages",
      "brainRequest",
      "capabilities",
      "permissions",
      "memory",
      "uiIntent",
      "expressiveIntent",
      "voice",
      "presence",
    ]) {
      expect(value).not.toHaveProperty(field);
    }
  });
});
