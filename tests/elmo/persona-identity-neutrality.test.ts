import { describe, expect, it } from "vitest";
import {
  AssistantIdentitySchema,
  BehavioralContextSchema,
  BrainRequestSchema,
  JsonObjectSchema,
  PersonaProfileSchema,
  RuntimeEventSchema,
  type BehavioralContext,
  type BrainProvider,
  type BrainRequest,
  type ExecutionContext,
  type RuntimeEvent,
} from "../../src/elmo/contracts";
import { composePersonaContext } from "../../src/elmo/persona/persona-composer";
import { CapabilityRegistry } from "../../src/elmo/registry/capability-registry";
import { ElmoRuntime } from "../../src/elmo/runtime/elmo-runtime";

const profileDefaults = {
  version: 1,
  relationalRole: "test partner",
  communicationDefaults: ["clear"],
  behaviorDefaults: ["ask for clarification"],
  principles: ["never fabricate certainty"],
};
const relationalPreferences = { verbosity: "concise" as const };
const interactionContext = { languageTag: "pt-BR", taskMode: "quick" as const };
const sources: BehavioralContext[] = [
  {
    identity: { id: "assistant-one", displayName: "Fixture One", version: 1 },
    personaProfile: { ...profileDefaults, identityId: "assistant-one", traits: ["methodical"] },
    relationalPreferences,
    interactionContext,
  },
  {
    identity: { id: "assistant-two", displayName: "Fixture Two", version: 1 },
    personaProfile: { ...profileDefaults, identityId: "assistant-two", traits: ["exploratory"] },
    relationalPreferences,
    interactionContext,
  },
];

function compositions(): BehavioralContext[] {
  return sources.map((source) => {
    const result = composePersonaContext(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid test composition");
    return result.value;
  });
}

// Test-only observer: response depends on request correlation, never on identity.
function createCapturingBrain() {
  const calls: { request: BrainRequest; context: ExecutionContext }[] = [];
  const brain: BrainProvider = {
    id: "identity-neutral-test-brain",
    async respond(request, context) {
      calls.push({ request, context });
      const validated = BrainRequestSchema.parse(request);
      return {
        ok: true,
        value: { requestId: validated.requestId, text: "Deterministic test response" },
      };
    },
  };
  return { brain, calls };
}

describe("identity-neutral persona infrastructure", () => {
  it("composes two fictitious identities with the same strict JSON-safe contracts", () => {
    const contexts = compositions();
    for (const [index, context] of contexts.entries()) {
      expect(AssistantIdentitySchema.parse(context.identity)).toEqual(sources[index].identity);
      expect(PersonaProfileSchema.parse(context.personaProfile)).toEqual(sources[index].personaProfile);
      expect(context.personaProfile.identityId).toBe(context.identity.id);
      expect(BehavioralContextSchema.parse(context)).toEqual(sources[index]);
      expect(JsonObjectSchema.parse(context)).toEqual(context);
      expect(JSON.parse(JSON.stringify(context))).toEqual(context);
      expect(BehavioralContextSchema.safeParse({ ...context, unknown: true }).success).toBe(false);
      expect(AssistantIdentitySchema.safeParse({ ...context.identity, unknown: true }).success).toBe(false);
      expect(PersonaProfileSchema.safeParse({ ...context.personaProfile, unknown: true }).success).toBe(false);
    }

    const [first, second] = contexts;
    expect(first.identity).not.toEqual(second.identity);
    expect(first.personaProfile).not.toEqual(second.personaProfile);
    expect(first.relationalPreferences).toEqual(second.relationalPreferences);
    expect(first.interactionContext).toEqual(second.interactionContext);
    expect(second).toEqual({
      ...first,
      identity: sources[1].identity,
      personaProfile: sources[1].personaProfile,
    });
  });

  it("passes each identity unchanged through one Runtime and one BrainProvider in sequential turns", async () => {
    const contexts = compositions();
    const contextsBefore = structuredClone(contexts);
    const sourcesBefore = structuredClone(sources);
    const { brain, calls } = createCapturingBrain();
    const registry = new CapabilityRegistry();
    const runtime = new ElmoRuntime(brain, registry);

    for (const [index, context] of contexts.entries()) {
      const turnId = `identity-turn-${index + 1}`;
      const local = { turnId };
      const turn = { id: turnId, input: "Test the shared infrastructure", context };
      const turnBefore = structuredClone(turn);
      const events: RuntimeEvent[] = [];
      for await (const event of runtime.run(turn, local)) {
        expect(RuntimeEventSchema.parse(event)).toEqual(event);
        events.push(event);
      }

      expect(events).toEqual([
        { type: "turn.started", turnId },
        {
          type: "turn.completed",
          turnId,
          response: { requestId: turnId, text: "Deterministic test response" },
        },
      ]);
      expect(calls).toHaveLength(index + 1);
      expect(calls[index].context).toBe(local);
      expect(calls[index].request).toEqual({
        requestId: turnId,
        turnId,
        messages: [{ role: "user", text: turn.input }],
        context: contextsBefore[index],
      });
      expect(turn).toEqual(turnBefore);
      expect(contexts).toEqual(contextsBefore);
      expect(sources).toEqual(sourcesBefore);
    }

    // Inspect the actual first request again after the second turn has completed.
    expect(calls.map((call) => BehavioralContextSchema.parse(call.request.context))).toEqual(contextsBefore);
    expect(registry.list()).toEqual([]);
  });
});
