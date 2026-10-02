import { describe, expect, it } from "vitest";
import { BrainResponseSchema, BrainStreamEventSchema, type BrainProvider, type BrainRequest, type BrainResponse, type BrainStreamEvent } from "../../../src/elmo/contracts/brain";
import { ElmoErrorSchema, type ContractResult, type ElmoError } from "../../../src/elmo/contracts/errors";

/** A provider adapter maps these scenarios to its own deterministic test setup. */
export type ProviderScenario = {
  response: Omit<BrainResponse, "requestId">;
  events?: BrainStreamEvent[];
  error?: ElmoError;
  waitFor?: Promise<void>;
};
export const request: BrainRequest = {
  requestId: "brain-1", turnId: "turn-1", messages: [{ role: "user", text: "Hello" }],
};
const context = { turnId: "turn-1" };

export function assertCancelledResult(result: ContractResult<BrainResponse>) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(ElmoErrorSchema.parse(result.error)).toEqual(JSON.parse(JSON.stringify(result.error)));
    expect(result.error).toMatchObject({ code: "CANCELLED", retryable: false });
  }
}

export function assertCancelledEvent(event: BrainStreamEvent, requestId: string) {
  expect(BrainStreamEventSchema.parse(event)).toEqual(JSON.parse(JSON.stringify(event)));
  expect(event).toMatchObject({ type: "error", requestId, error: { code: "CANCELLED", retryable: false } });
}

export function brainProviderContract(
  name: string,
  create: (scenario: ProviderScenario) => BrainProvider,
  options: { streaming?: boolean } = {},
) {
  const streaming = options.streaming ?? true;
  describe(`${name} BrainProvider contract`, () => {
    it("has a required nonempty provider identity", () => {
      const provider = create({ response: { text: "Hello" } });
      expect(provider.id).toEqual(expect.any(String));
      expect(provider.id.trim().length).toBeGreaterThan(0);
    });
    it("responds with scripted text and no capability request", async () => {
      const provider = create({ response: { text: "Hello" } });
      const result = await provider.respond(request, context);
      expect(result).toMatchObject({ ok: true, value: { requestId: "brain-1", text: "Hello" } });
      if (result.ok) {
        expect(result.value.capabilityRequests ?? []).toEqual([]);
        expect(result.value.uiIntents ?? []).toEqual([]);
        expect(BrainResponseSchema.parse(result.value)).toEqual(JSON.parse(JSON.stringify(result.value)));
      }
    });
    it("outputs a normalized capability request without executing it", async () => {
      const provider = create({ response: {
        text: "", capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
      } });
      const result = await provider.respond(request, context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(BrainResponseSchema.parse(result.value)).toEqual(JSON.parse(JSON.stringify(result.value)));
        expect({ ...result.value, uiIntents: result.value.uiIntents ?? [] }).toEqual({
          requestId: "brain-1", text: "",
          capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
          uiIntents: [],
        });
      }
    });
    it("outputs a semantic UI intent when scripted", async () => {
      const provider = create({ response: { text: "Focus", uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }] } });
      const result = await provider.respond(request, context);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(BrainResponseSchema.parse(result.value)).toEqual(JSON.parse(JSON.stringify(result.value)));
        expect({ ...result.value, capabilityRequests: result.value.capabilityRequests ?? [] }).toEqual({
          requestId: "brain-1", text: "Focus", uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }],
          capabilityRequests: [],
        });
      }
    });
    it.skipIf(!streaming)("preserves capability requests and UI intents in final stream completion", async () => {
      const provider = create({ response: {
        text: "Focus", capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
        uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }],
      } });
      const events = await Array.fromAsync(provider.stream!(request, context));
      for (const event of events) expect(BrainStreamEventSchema.parse(event)).toEqual(JSON.parse(JSON.stringify(event)));
      for (const event of events.slice(0, -1)) expect(event).toMatchObject({ type: "text.delta", requestId: "brain-1" });
      expect(events.filter((event) => event.type === "response.completed")).toHaveLength(1);
      expect(events.at(-1)).toEqual({ type: "response.completed", response: {
        requestId: "brain-1", text: "Focus",
        capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
        uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }],
      } });
      expect(await provider.respond(request, context)).toEqual({ ok: true, value: {
        requestId: "brain-1", text: "Focus",
        capabilityRequests: [{ requestId: "cap-1", capabilityId: "calendar.read", input: { day: "today" } }],
        uiIntents: [{ type: "context.focus", payload: { contextId: "context-1" } }],
      } });
    });
    it.skipIf(!streaming)("streams scripted provider-neutral events then one matching final completion", async () => {
      const provider = create({ response: { text: "Hello" }, events: [
        { type: "text.delta", requestId: "brain-1", delta: "Hel" },
        { type: "text.delta", requestId: "brain-1", delta: "lo" },
      ] });
      expect(provider.stream).toEqual(expect.any(Function));
      const events = await Array.fromAsync(provider.stream!(request, context));
      expect(events).toMatchObject([
        { type: "text.delta", requestId: "brain-1", delta: "Hel" },
        { type: "text.delta", requestId: "brain-1", delta: "lo" },
        { type: "response.completed", response: { requestId: "brain-1", text: "Hello" } },
      ]);
      for (const event of events) expect(BrainStreamEventSchema.parse(event)).toEqual(JSON.parse(JSON.stringify(event)));
      const response = await provider.respond(request, context);
      expect(response.ok).toBe(true);
      if (response.ok) expect(events.at(-1)).toEqual({ type: "response.completed", response: response.value });
    });
    it("returns a standardized scripted error", async () => {
      const error: ElmoError = { code: "PROVIDER_ERROR", message: "Unavailable", retryable: true, details: { reason: "busy" } };
      const provider = create({ response: { text: "ignored" }, error });
      const result = await provider.respond(request, context);
      expect(result).toEqual({ ok: false, error: { code: "PROVIDER_ERROR", message: "Unavailable", retryable: true, details: { reason: "busy" } } });
      if (!result.ok) expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
      if (streaming) expect(await Array.fromAsync(provider.stream!(request, context))).toEqual([
        { type: "error", requestId: "brain-1", error: { code: "PROVIDER_ERROR", message: "Unavailable", retryable: true, details: { reason: "busy" } } },
      ]);
    });
    it("cancels a pre-aborted request in both modes without emitting scripted text", async () => {
      const controller = new AbortController();
      controller.abort(new Error("private abort reason"));
      const provider = create({ response: { text: "ignored" }, events: [{ type: "text.delta", requestId: "brain-1", delta: "ignored" }] });
      const cancelledContext = { ...context, signal: controller.signal };
      assertCancelledResult(await provider.respond(request, cancelledContext));
      if (streaming) {
        const events = await Array.fromAsync(provider.stream!(request, cancelledContext));
        expect(events).toHaveLength(1);
        assertCancelledEvent(events[0], "brain-1");
      }
    });
    it.skipIf(!streaming)("stops streaming immediately after cancellation between events", async () => {
      const controller = new AbortController();
      const provider = create({ response: { text: "Hello" }, events: [
        { type: "text.delta", requestId: "brain-1", delta: "Hel" },
        { type: "text.delta", requestId: "brain-1", delta: "lo" },
      ] });
      const iterator = provider.stream!(request, { ...context, signal: controller.signal })[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toEqual({ type: "text.delta", requestId: "brain-1", delta: "Hel" });
      controller.abort();
      assertCancelledEvent((await iterator.next()).value, "brain-1");
      expect((await iterator.next()).done).toBe(true);
    });
    it.each(streaming ? ["respond", "stream"] as const : ["respond"] as const)("cancels pending %s without waiting for the scripted gate", async (mode) => {
      const controller = new AbortController();
      let release!: () => void;
      const waitFor = new Promise<void>((resolve) => { release = resolve; });
      const provider = create({ response: { text: "Hello" }, waitFor });
      const cancelledContext = { ...context, signal: controller.signal };
      let settled = false;
      const pending = (mode === "respond" ? provider.respond(request, cancelledContext) : Array.fromAsync(provider.stream!(request, cancelledContext)))
        .then((result) => { settled = true; return result; });
      await Promise.resolve();
      expect(settled).toBe(false);
      controller.abort();
      const result = await pending;
      if (Array.isArray(result)) {
        expect(result).toHaveLength(1);
        assertCancelledEvent(result[0], "brain-1");
      } else assertCancelledResult(result);
      release();
    });
  });
}
