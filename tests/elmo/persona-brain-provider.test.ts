import { describe, expect, it, vi } from "vitest";
import {
  BehavioralContextSchema,
  BrainRequestSchema,
  BrainResponseSchema,
  JsonObjectSchema,
  type BehavioralContext,
  type BrainProvider,
  type ExecutionContext,
} from "../../src/elmo/contracts";
import { composePersonaContext } from "../../src/elmo/persona/persona-composer";
import { MockBrain } from "./support/mock-brain";

function composeOnce(): BehavioralContext {
  const result = composePersonaContext({
    identity: { id: "assistant-test", displayName: "Test Assistant", version: 1 },
    personaProfile: {
      identityId: "assistant-test",
      version: 1,
      traits: ["curious", "empathetic"],
      relationalRole: "trusted partner",
      communicationDefaults: ["clear", "warm"],
      behaviorDefaults: ["ask when clarification is needed"],
      principles: ["never fabricate certainty"],
    },
    relationalPreferences: { formality: "balanced", verbosity: "concise" },
    interactionContext: { languageTag: "pt-BR", taskMode: "quick" },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid test composition");
  return result.value;
}

// Minimal substitution fixture only; it does not interpret or own Persona.
function createTestBrain(): BrainProvider {
  return {
    id: "deterministic-test-brain",
    async respond(request) {
      const validated = BrainRequestSchema.parse(request);
      return {
        ok: true,
        value: BrainResponseSchema.parse({
          requestId: validated.requestId,
          text: "Second deterministic answer",
        }),
      };
    },
  };
}

describe("product-owned persona across test BrainProviders", () => {
  it("sends one JSON-safe composition unchanged to distinct providers with different responses", async () => {
    // Composition happens once, before either provider is created or selected.
    const persona = composeOnce();
    const before = structuredClone(persona);
    expect(BehavioralContextSchema.parse(persona)).toEqual(before);
    expect(JsonObjectSchema.parse(persona)).toEqual(before);
    const serialized = JSON.parse(JSON.stringify(persona));
    expect(serialized).toEqual(before);

    const request = BrainRequestSchema.parse({
      requestId: "persona-request",
      turnId: "persona-turn",
      messages: [{ role: "user", text: "Help me plan a task" }],
      context: serialized,
    });
    const requestBefore = structuredClone(request);
    const executionContext: ExecutionContext = { turnId: request.turnId };
    const mock = new MockBrain({ response: { text: "First deterministic answer" } });
    const mockRespond = vi.spyOn(mock, "respond");
    const second = createTestBrain();
    const secondRespond = vi.spyOn(second, "respond");
    const providers: BrainProvider[] = [mock, second];
    const responses = [];

    for (const provider of providers) {
      const result = await provider.respond(request, executionContext);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected valid test response");
      responses.push(BrainResponseSchema.parse(result.value));
      // Compare actual objects passed to the provider, not unused fixture copies.
      expect(request).toEqual(requestBefore);
      expect(persona).toEqual(before);
    }

    for (const observer of [mockRespond, secondRespond]) {
      expect(observer).toHaveBeenCalledTimes(1);
      const [received, receivedExecutionContext] = observer.mock.calls[0];
      expect(receivedExecutionContext).toBe(executionContext);
      expect(BehavioralContextSchema.parse(received.context)).toEqual(before);
      expect(received.messages).toEqual(requestBefore.messages);
    }
    expect(mock.id).not.toBe(second.id);
    expect(responses.map((response) => response.text)).toEqual([
      "First deterministic answer",
      "Second deterministic answer",
    ]);
    expect(responses.map((response) => response.requestId)).toEqual([
      request.requestId,
      request.requestId,
    ]);
  });

  it.each([
    ["provider selection", "providerId", "test-brain"],
    ["model configuration", "model", "test-model"],
    ["credentials", "credentials", { key: "not-a-secret" }],
    ["routing", "routing", "fallback"],
    ["prompt blob", "systemPrompt", "arbitrary instructions"],
    ["authority", "permissions", ["grant"]],
    ["capabilities", "capabilities", ["execute"]],
    ["memory", "memory", {}],
    ["rendering", "html", "<div />"],
  ])("rejects %s in the composed behavioral boundary", (_label, field, value) => {
    expect(BehavioralContextSchema.safeParse({ ...composeOnce(), [field]: value }).success).toBe(false);
  });
});
