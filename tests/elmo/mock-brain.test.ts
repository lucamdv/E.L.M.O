import { describe, expect, it } from "vitest";
import type { BrainResponse, BrainStreamEvent } from "../../src/elmo/contracts/brain";
import type { ElmoError } from "../../src/elmo/contracts/errors";
import { brainProviderContract, request } from "./support/brain-provider-contract";
import { MockBrain } from "./support/mock-brain";

brainProviderContract("MockBrain", (scenario) => new MockBrain(scenario));
brainProviderContract("MockBrain valid alternative envelope shapes", (scenario) => new MockBrain({
  ...scenario,
  response: {
    ...scenario.response,
    capabilityRequests: scenario.response.capabilityRequests ?? [],
    uiIntents: scenario.response.uiIntents ?? [],
  },
  events: scenario.response.capabilityRequests?.length && scenario.response.uiIntents?.length
    ? [{ type: "text.delta", requestId: "brain-1", delta: "Focus" }, ...scenario.events ?? []]
    : scenario.events,
}));

describe("MockBrain programming", () => {
  it("replays combined-output deltas exactly before the scripted final response", async () => {
    const provider = new MockBrain({ response: {
      text: "Focus", capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
      uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }],
    }, events: [{ type: "text.delta", requestId: "brain-1", delta: "Focus" }] });
    expect(await Array.fromAsync(provider.stream(request, { turnId: "turn-1" }))).toEqual([
      { type: "text.delta", requestId: "brain-1", delta: "Focus" },
      { type: "response.completed", response: {
        requestId: "brain-1", text: "Focus",
        capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
        uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }],
      } },
    ]);
  });
  it.each(["respond", "stream"] as const)("standardizes a rejected programming gate in %s", async (mode) => {
    const waitFor = Promise.reject(new Error("private gate failure"));
    const provider = new MockBrain({ response: { text: "Hello" }, waitFor });
    const context = { turnId: "turn-1" };
    const result = await (mode === "respond" ? provider.respond(request, context) : Array.fromAsync(provider.stream(request, context)));
    const error = { code: "INTERNAL_ERROR", message: "An unexpected error occurred", retryable: false };
    expect(result).toEqual(mode === "respond" ? { ok: false, error } : [{ type: "error", requestId: "brain-1", error }]);
  });
  it.each([
    { name: "SDK response field", script: { response: { text: "Hello", sdkResponse: new Error("private") } as Omit<BrainResponse, "requestId"> } },
    { name: "SDK capability input", script: { response: { text: "", capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: new Date() }] } as unknown as Omit<BrainResponse, "requestId"> } },
    { name: "SDK error", script: { response: { text: "Hello" }, error: new Error("private") as unknown as ElmoError } },
  ])("rejects $name rather than exposing it", async ({ script }) => {
    const provider = new MockBrain(script);
    const result = await provider.respond(request, { turnId: "turn-1" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", retryable: false } });
    const events = await Array.fromAsync(provider.stream(request, { turnId: "turn-1" }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", error: { code: "VALIDATION_ERROR" } });
    expect(JSON.stringify(events)).not.toContain("private");
  });
  it("rejects SDK-specific stream events before yielding them", async () => {
    const provider = new MockBrain({ response: { text: "Hello" }, events: [
      { type: "text.delta", requestId: "brain-1", delta: "Hello", sdkChunk: new Error("private") } as BrainStreamEvent,
    ] });
    const events = await Array.fromAsync(provider.stream(request, { turnId: "turn-1" }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", requestId: "brain-1", error: { code: "VALIDATION_ERROR" } });
    expect(JSON.stringify(events)).not.toContain("private");
  });
  it.each([
    { type: "response.completed", response: { requestId: "brain-1", text: "Hello" } },
    { type: "error", requestId: "brain-1", error: { code: "PROVIDER_ERROR", message: "Stopped", retryable: false } },
  ] satisfies BrainStreamEvent[])("stops after a scripted $type terminal event", async (terminal) => {
    const provider = new MockBrain({ response: { text: "Hello" }, events: [terminal,
      { type: "text.delta", requestId: "brain-1", delta: "must not leak" },
    ] });
    expect(await Array.fromAsync(provider.stream(request, { turnId: "turn-1" }))).toEqual([terminal]);
  });
  it.each([
    { type: "text.delta", requestId: "wrong-request", delta: "Hello" },
    { type: "response.completed", response: { requestId: "brain-1", text: "Different" } },
  ] satisfies BrainStreamEvent[])("rejects uncorrelated or inconsistent scripted events: $type", async (event) => {
    const provider = new MockBrain({ response: { text: "Hello" }, events: [event] });
    const events = await Array.fromAsync(provider.stream(request, { turnId: "turn-1" }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", requestId: "brain-1", error: { code: "VALIDATION_ERROR" } });
  });
});
