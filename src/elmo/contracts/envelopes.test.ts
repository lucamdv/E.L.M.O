import { describe, expect, it } from "vitest";
import * as contracts from "./index";

const failure = { code: "PERMISSION_DENIED", message: "Not permitted", retryable: false };
const request = { requestId: "request-1", capabilityId: "calendar.read", input: { day: "today" } };
const response = { requestId: "brain-1", text: "Hello", capabilityRequests: [request], uiIntents: [{ type: "message.show", payload: { text: "Hello" } }] };
const fixtures = [
  { name: "brain request", schema: () => contracts.BrainRequestSchema, value: { requestId: "brain-1", turnId: "turn-1", messages: [{ role: "user", text: "Hello" }], stream: true }, invalid: { requestId: "brain-1", turnId: "turn-1", messages: [] } },
  { name: "brain response", schema: () => contracts.BrainResponseSchema, value: response, invalid: { ...response, uiIntents: [{ type: "render.html", payload: { html: "<div/>" } }] } },
  { name: "brain stream delta", schema: () => contracts.BrainStreamEventSchema, value: { type: "text.delta", requestId: "brain-1", delta: "Hello" }, invalid: { type: "text.delta", requestId: "brain-1", delta: 1 } },
  { name: "capability request", schema: () => contracts.CapabilityRequestSchema, value: request, invalid: { ...request, capabilityId: "" } },
  { name: "capability permission", schema: () => contracts.CapabilityPermissionSchema, value: { scopes: ["calendar.read"], requiresConfirmation: true }, invalid: { scopes: [""], requiresConfirmation: true } },
  { name: "capability success", schema: () => contracts.CapabilityResultSchema, value: { requestId: "request-1", capabilityId: "calendar.read", ok: true, output: ["meeting"] }, invalid: { requestId: "request-1", capabilityId: "calendar.read", ok: true, error: failure } },
  { name: "capability failure", schema: () => contracts.CapabilityResultSchema, value: { requestId: "request-1", capabilityId: "calendar.read", ok: false, error: failure }, invalid: { requestId: "request-1", capabilityId: "calendar.read", ok: false, error: new Error("private") } },
  { name: "memory record", schema: () => contracts.MemoryRecordSchema, value: { id: "memory-1", content: { preference: "quiet" } }, invalid: { id: "memory-1", content: undefined } },
  { name: "memory context query", schema: () => contracts.MemoryContextQuerySchema, value: { query: "preferences", limit: 5 }, invalid: { query: "preferences", limit: 0 } },
  { name: "automation definition", schema: () => contracts.AutomationDefinitionSchema, value: { id: "automation-1", trigger: { type: "time", config: { at: "09:00" } }, action: { capabilityId: "reminder.create", input: { text: "Pause" } }, delivery: { type: "inbox", config: {} } }, invalid: { id: "automation-1", trigger: { type: "time", config: {} } } },
  { name: "event envelope", schema: () => contracts.EventEnvelopeSchema, value: { id: "event-1", type: "memory.updated", timestamp: "2026-10-02T12:00:00Z", payload: { id: "memory-1" } }, invalid: { id: "event-1", type: "memory.updated", timestamp: "later", payload: null } },
  { name: "runtime turn", schema: () => contracts.RuntimeTurnSchema, value: { id: "turn-1", input: "Hello", context: { locale: "pt-BR" } }, invalid: { id: "turn-1", input: "" } },
  { name: "runtime completion", schema: () => contracts.RuntimeEventSchema, value: { type: "turn.completed", turnId: "turn-1", response }, invalid: { type: "turn.completed", turnId: "turn-1" } },
];

describe("representative contract envelopes", () => {
  for (const fixture of fixtures) {
    it(`accepts serializable ${fixture.name}`, () => {
      expect(fixture.schema()?.safeParse(JSON.parse(JSON.stringify(fixture.value))).success).toBe(true);
    });
    it(`rejects malformed ${fixture.name}`, () => {
      expect(fixture.schema()?.safeParse(fixture.invalid).success).toBe(false);
    });
    it(`rejects extra fields in ${fixture.name}`, () => {
      expect(fixture.schema()?.safeParse({ ...fixture.value, arbitrary: "extra" }).success).toBe(false);
    });
  }

  it.each([
    { type: "response.completed", response },
    { type: "error", requestId: "brain-1", error: failure },
  ])("accepts provider-neutral stream event %j", (event) => {
    expect(contracts.BrainStreamEventSchema?.safeParse(event).success).toBe(true);
  });

  it.each([
    { type: "turn.started", turnId: "turn-1" },
    { type: "text.delta", turnId: "turn-1", delta: "Hello" },
    { type: "ui.intent", turnId: "turn-1", intent: { type: "context.focus", payload: { contextId: "context-1" } } },
    { type: "capability.result", turnId: "turn-1", result: { requestId: "request-1", capabilityId: "calendar.read", ok: false, error: failure } },
    { type: "turn.failed", turnId: "turn-1", error: failure },
    { type: "turn.cancelled", turnId: "turn-1" },
  ])("accepts transport-independent runtime event %j", (event) => {
    expect(contracts.RuntimeEventSchema?.safeParse(event).success).toBe(true);
  });

  it("accepts an optional condition without imposing an automation DSL", () => {
    const value = fixtures.find((fixture) => fixture.name === "automation definition")!.value;
    expect(contracts.AutomationDefinitionSchema?.safeParse({ ...value, condition: { type: "presence", config: { state: "available" } } }).success).toBe(true);
  });

  it("rejects nonserializable cancellation objects on serialized envelopes", () => {
    const signal = new AbortController().signal;
    expect(contracts.BrainRequestSchema?.safeParse({ ...fixtures[0].value, signal }).success).toBe(false);
    expect(contracts.RuntimeTurnSchema?.safeParse({ id: "turn-1", input: "Hello", context: { signal } }).success).toBe(false);
    expect(contracts.RuntimeEventSchema?.safeParse({ type: "turn.started", turnId: "turn-1", signal }).success).toBe(false);
  });
});
