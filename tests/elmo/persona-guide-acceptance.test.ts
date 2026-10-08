import { describe, expect, it, vi } from "vitest";
import {
  AssistantIdentitySchema,
  BehavioralContextSchema,
  BrainRequestSchema,
  BrainResponseSchema,
  JsonObjectSchema,
  PersonaProfileSchema,
  RuntimeEventSchema,
  RuntimeTurnSchema,
  type BehavioralContext,
  type BrainProvider,
  type RuntimeEvent,
} from "../../src/elmo/contracts";
import { composePersonaContext } from "../../src/elmo/persona/persona-composer";
import { getElmoPersona } from "../../src/elmo/persona/elmo-persona";
import { CapabilityRegistry } from "../../src/elmo/registry/capability-registry";
import { ElmoRuntime } from "../../src/elmo/runtime/elmo-runtime";
import { MockBrain } from "./support/mock-brain";

// Canonical product-owned stable layers; preferences/context remain test-only.
function elmoContext(): BehavioralContext {
  return {
    ...getElmoPersona(),
    relationalPreferences: { formality: "balanced", verbosity: "balanced" },
    interactionContext: { languageTag: "pt-BR", taskMode: "explanatory" },
  };
}

function compose(source: BehavioralContext): BehavioralContext {
  const result = composePersonaContext(source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid acceptance composition");
  expect(AssistantIdentitySchema.parse(result.value.identity)).toEqual(source.identity);
  expect(PersonaProfileSchema.parse(result.value.personaProfile)).toEqual(source.personaProfile);
  expect(BehavioralContextSchema.parse(result.value)).toEqual(source);
  expect(JsonObjectSchema.parse(result.value)).toEqual(source);
  expect(JSON.parse(JSON.stringify(result.value))).toEqual(source);
  return result.value;
}

// This provider validates shared envelopes; its response never reads Persona.
function testBrain() {
  const respond = vi.fn<BrainProvider["respond"]>(async (request) => {
    const validated = BrainRequestSchema.parse(request);
    return { ok: true, value: BrainResponseSchema.parse({
      requestId: validated.requestId, text: "Deterministic acceptance answer",
    }) };
  });
  const brain: BrainProvider = { id: "acceptance-test-brain", respond };
  return { brain, respond };
}

async function runTurn(runtime: ElmoRuntime, context: BehavioralContext, turnId: string, text: string) {
  const turn = RuntimeTurnSchema.parse({ id: turnId, input: "Help me plan a task", context });
  const before = structuredClone(turn);
  const local = { turnId };
  const events: RuntimeEvent[] = [];
  for await (const event of runtime.run(turn, local)) {
    expect(RuntimeEventSchema.parse(event)).toEqual(event);
    events.push(event);
  }
  expect(events).toEqual([
    { type: "turn.started", turnId },
    { type: "turn.completed", turnId, response: { requestId: turnId, text } },
  ]);
  expect(turn).toEqual(before);
  return { turn: before, local };
}

function inspectCall(call: Parameters<BrainProvider["respond"]>, execution: Awaited<ReturnType<typeof runTurn>>, streaming = false) {
  const [request, local] = call;
  expect(BrainRequestSchema.parse(request)).toEqual(request);
  expect(request).toEqual({
    requestId: execution.turn.id, turnId: execution.turn.id,
    messages: [{ role: "user", text: execution.turn.input }],
    context: execution.turn.context,
    ...(streaming ? { stream: true } : {}),
  });
  expect(local).toBe(execution.local);
  return BehavioralContextSchema.parse(request.context);
}

describe("GUIA 16 architectural / behavioral integration acceptance", () => {
  it("A — preserves one product-owned Persona across two BrainProviders through Runtime", async () => {
    const source = elmoContext();
    const sourceBefore = structuredClone(source);
    // Exactly one composition, before either provider exists.
    const context = compose(source);
    const before = structuredClone(context);
    const mock = new MockBrain({ response: { text: "Mock acceptance answer" } });
    const mockRespond = vi.spyOn(mock, "respond");
    const { brain, respond } = testBrain();
    expect(mock.id).not.toBe(brain.id);
    const registry = new CapabilityRegistry();

    const first = await runTurn(new ElmoRuntime(mock, registry), context, "provider-a-turn", "Mock acceptance answer");
    expect(context).toEqual(before);
    const second = await runTurn(new ElmoRuntime(brain, registry), context, "provider-b-turn", "Deterministic acceptance answer");

    expect(mockRespond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(inspectCall(mockRespond.mock.calls[0], first, true)).toEqual(before);
    expect(inspectCall(respond.mock.calls[0], second)).toEqual(before);
    expect(context).toEqual(before);
    expect(source).toEqual(sourceBefore);
    expect(registry.list()).toEqual([]);
  });

  it("B — isolates two identities in sequential turns on one Runtime and BrainProvider", async () => {
    const firstSource = elmoContext();
    const secondSource: BehavioralContext = {
      ...structuredClone(firstSource),
      identity: { id: "fixture-companion", displayName: "Fixture Companion", version: 1 },
      personaProfile: { ...structuredClone(firstSource.personaProfile), identityId: "fixture-companion", traits: ["methodical"] },
    };
    const sources = [firstSource, secondSource];
    const sourcesBefore = structuredClone(sources);
    const contexts = sources.map(compose);
    const before = structuredClone(contexts);
    expect(contexts[0].identity).not.toEqual(contexts[1].identity);
    const { brain, respond } = testBrain();
    const registry = new CapabilityRegistry();
    const runtime = new ElmoRuntime(brain, registry);

    const first = await runTurn(runtime, contexts[0], "identity-a-turn", "Deterministic acceptance answer");
    expect(respond).toHaveBeenCalledTimes(1);
    expect(inspectCall(respond.mock.calls[0], first)).toEqual(before[0]);
    const second = await runTurn(runtime, contexts[1], "identity-b-turn", "Deterministic acceptance answer");
    expect(respond).toHaveBeenCalledTimes(2);
    // Reinspect the first actual request after the second turn: no contamination.
    expect(inspectCall(respond.mock.calls[0], first)).toEqual(before[0]);
    expect(inspectCall(respond.mock.calls[1], second)).toEqual(before[1]);
    expect(contexts).toEqual(before);
    expect(sources).toEqual(sourcesBefore);
    expect(registry.list()).toEqual([]);
  });

  it("C — transports distinct relational preferences without replacing identity or invariants", async () => {
    const stable = elmoContext();
    const stableBefore = structuredClone(stable);
    // These names address the user, not the assistant; no alias recognition is tested.
    const preferences: BehavioralContext["relationalPreferences"][] = [
      { preferredFormOfAddress: "Lu", formality: "informal", verbosity: "concise", humorIntensity: "high" },
      { preferredFormOfAddress: "Luca", formality: "formal", verbosity: "detailed", humorIntensity: "low" },
    ];
    const sources = preferences.map((relationalPreferences) => ({ ...stable, relationalPreferences }));
    const sourcesBefore = structuredClone(sources);
    const contexts = sources.map(compose);
    const before = structuredClone(contexts);
    expect(contexts[0]).not.toBe(contexts[1]);
    expect(contexts[0].relationalPreferences).not.toBe(contexts[1].relationalPreferences);
    expect(contexts[0].relationalPreferences).not.toEqual(contexts[1].relationalPreferences);
    expect(contexts[1]).toEqual({ ...contexts[0], relationalPreferences: preferences[1] });
    const { brain, respond } = testBrain();
    const registry = new CapabilityRegistry();
    const runtime = new ElmoRuntime(brain, registry);

    const executions = [];
    for (const [index, context] of contexts.entries()) {
      executions.push(await runTurn(runtime, context, `relational-turn-${index}`, "Deterministic acceptance answer"));
      expect(contexts).toEqual(before);
    }
    expect(respond).toHaveBeenCalledTimes(2);
    for (const [index, execution] of executions.entries()) {
      const received = inspectCall(respond.mock.calls[index], execution);
      expect(received).toEqual(before[index]);
      expect(received.identity).toEqual(stableBefore.identity);
      expect(received.personaProfile).toEqual(stableBefore.personaProfile);
      expect(received.interactionContext).toEqual(stableBefore.interactionContext);
      expect(received.relationalPreferences).toEqual(preferences[index]);
    }
    expect(sources).toEqual(sourcesBefore);
    expect(stable).toEqual(stableBefore);
    expect(registry.list()).toEqual([]);
  });
});
