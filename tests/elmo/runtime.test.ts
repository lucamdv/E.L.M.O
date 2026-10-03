import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { type BrainProvider, type BrainRequest, type BrainStreamEvent, type ExecutionContext, RuntimeEventSchema, type RuntimeEvent, type ContractResult, type BrainResponse, type CapabilityDefinition, type JsonValue, createElmoError } from "../../src/elmo/contracts";
import { MockBrain } from "./support/mock-brain";
import { CapabilityRegistry } from "../../src/elmo/registry/capability-registry";
import { ElmoRuntime } from "../../src/elmo/runtime/elmo-runtime";

async function collect(events: AsyncIterable<RuntimeEvent>) {
  const result: RuntimeEvent[] = [];
  for await (const event of events) {
    expect(RuntimeEventSchema.safeParse(event).success).toBe(true);
    result.push(event);
  }
  return result;
}

const turn = { id: "turn-1", input: "Hi" };
const context: ExecutionContext = { turnId: "turn-1" };
function responseBrain(value: unknown): BrainProvider {
  return { id: "test-brain", async respond() { return value as ContractResult<BrainResponse>; } };
}
const response = { requestId: "turn-1", text: "Hello" };
function streamBrain(events: unknown[]): BrainProvider {
  return { ...responseBrain({ ok: true, value: response }), async *stream() { for (const event of events) yield event as BrainStreamEvent; } };
}
function capability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: "test.echo", description: "Test-only echo", inputSchema: z.string(), outputSchema: z.string(),
    permission: { scopes: [], requiresConfirmation: false },
    async execute(input) { return { ok: true, value: input }; }, ...overrides,
  };
}
const capabilityRequest = { requestId: "cap-1", capabilityId: "test.echo", input: "value" };
function capabilityRuntime(definitions: CapabilityDefinition[], requests = [capabilityRequest], uiIntents?: BrainResponse["uiIntents"]) {
  const registry = new CapabilityRegistry();
  for (const definition of definitions) expect(registry.register(definition).ok).toBe(true);
  return new ElmoRuntime(new MockBrain({ response: { text: "Hello", capabilityRequests: requests, ...(uiIntents ? { uiIntents } : {}) } }), registry);
}

describe("ElmoRuntime", () => {
  it("starts and completes a respond-only turn with a deterministic request and the same local context", async () => {
    const controller = new AbortController();
    const context: ExecutionContext = { turnId: "turn-1", signal: controller.signal };
    const calls: { request: BrainRequest; context: ExecutionContext }[] = [];
    const brain: BrainProvider = {
      id: "test-brain",
      async respond(request, local) {
        calls.push({ request, context: local });
        return { ok: true, value: { requestId: request.requestId, text: "Hello" } };
      },
    };
    const runtime = new ElmoRuntime(brain, new CapabilityRegistry());
    const events = await collect(runtime.run({ id: "turn-1", input: "Hi", context: { topic: "test" } }, context));
    expect(events).toEqual([
      { type: "turn.started", turnId: "turn-1" },
      { type: "turn.completed", turnId: "turn-1", response: { requestId: "turn-1", text: "Hello" } },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].request).toEqual({ requestId: "turn-1", turnId: "turn-1", messages: [{ role: "user", text: "Hi" }], context: { topic: "test" } });
    expect(calls[0].context).toBe(context);
    expect(calls[0].context.signal).toBe(controller.signal);
  });

  it.each([
    { input: "" }, { input: 42 }, { context: { value: undefined } }, { extra: true }, { id: "bad id" },
  ])("rejects invalid turn %j with a serializable failure before calling Brain", async (override) => {
    let calls = 0;
    const brain: BrainProvider = { id: "test-brain", async respond() { calls++; return { ok: true, value: response }; } };
    const events = await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run({ ...turn, ...override }, context));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "turn.failed", turnId: "turn-1", error: { code: "VALIDATION_ERROR" } });
    expect(calls).toBe(0);
  });

  it("rejects mismatched local correlation before Brain", async () => {
    const events = await collect(new ElmoRuntime(responseBrain({ ok: true, value: response }), new CapabilityRegistry()).run(turn, { turnId: "other" }));
    expect(events).toEqual([expect.objectContaining({ type: "turn.failed", turnId: "turn-1", error: expect.objectContaining({ code: "VALIDATION_ERROR" }) })]);
  });

  it("uses a deterministic fallback when neither input nor context supplies valid correlation", async () => {
    const events = await collect(new ElmoRuntime(responseBrain(null), new CapabilityRegistry()).run(null, { turnId: "bad id" }));
    expect(events).toEqual([expect.objectContaining({ type: "turn.failed", turnId: "invalid-turn" })]);
  });

  it.each([
    null, { ok: true, value: { ...response, requestId: "other" } },
    { ok: true, value: { ...response, text: undefined } },
    { ok: true, value: { ...response, uiIntents: [{ type: "unknown", payload: {} }] } },
    { ok: false, error: new Error("private sdk secret") },
    { ok: true, value: response, extra: "private" },
  ])("normalizes malformed Brain results %j to terminal validation errors", async (result) => {
    const events = await collect(new ElmoRuntime(responseBrain(result), new CapabilityRegistry()).run(turn, context));
    expect(events.map((event) => event.type)).toEqual(["turn.started", "turn.failed"]);
    expect(events[1]).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(JSON.stringify(events)).not.toMatch(/private|sdk|secret|stack/);
  });

  it("preserves deliberate public Brain errors as terminal failures", async () => {
    const error = createElmoError("PROVIDER_ERROR", "Brain unavailable", { retryable: true });
    const events = await collect(new ElmoRuntime(responseBrain({ ok: false, error }), new CapabilityRegistry()).run(turn, context));
    expect(events).toEqual([{ type: "turn.started", turnId: "turn-1" }, { type: "turn.failed", turnId: "turn-1", error }]);
  });

  it("hides arbitrary Brain exceptions behind a provider-neutral error", async () => {
    const brain: BrainProvider = { id: "private-provider", async respond() { throw new Error("private sdk secret"); } };
    const events = await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, context));
    expect(events[1]).toMatchObject({ type: "turn.failed", error: { code: "PROVIDER_ERROR" } });
    expect(JSON.stringify(events)).not.toMatch(/private|sdk|secret|stack/);
  });

  it("prefers stream, maps deltas, and uses the terminal response with the same context", async () => {
    let responds = 0;
    const requests: BrainRequest[] = [];
    const contexts: ExecutionContext[] = [];
    const brain: BrainProvider = {
      id: "test-brain",
      async respond() { responds++; return { ok: true, value: response }; },
      async *stream(request, local) {
        requests.push(request); contexts.push(local);
        yield { type: "text.delta", requestId: request.requestId, delta: "Hel" };
        yield { type: "text.delta", requestId: request.requestId, delta: "lo" };
        yield { type: "response.completed", response };
      },
    };
    expect(await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, context))).toEqual([
      { type: "turn.started", turnId: "turn-1" },
      { type: "text.delta", turnId: "turn-1", delta: "Hel" },
      { type: "text.delta", turnId: "turn-1", delta: "lo" },
      { type: "turn.completed", turnId: "turn-1", response },
    ]);
    expect(responds).toBe(0);
    expect(requests).toEqual([{ requestId: "turn-1", turnId: "turn-1", messages: [{ role: "user", text: "Hi" }], stream: true }]);
    expect(contexts[0]).toBe(context);
  });

  it("emits validated UI intents in declaration order using real MockBrain", async () => {
    const uiIntents: BrainResponse["uiIntents"] = [
      { type: "message.show", payload: { text: "Visible" } },
      { type: "context.focus", payload: { contextId: "topic-1" } },
    ];
    const brain = new MockBrain({ response: { text: "Hello", uiIntents } });
    const events = await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, context));
    expect(events).toEqual([
      { type: "turn.started", turnId: "turn-1" },
      { type: "ui.intent", turnId: "turn-1", intent: uiIntents[0] },
      { type: "ui.intent", turnId: "turn-1", intent: uiIntents[1] },
      { type: "turn.completed", turnId: "turn-1", response: { ...response, uiIntents } },
    ]);
  });

  it.each([
    [], [{ type: "text.delta", requestId: "turn-1", delta: "partial" }],
    [{ type: "text.delta", requestId: "other", delta: "wrong" }],
    [{ type: "response.completed", response: { ...response, requestId: "other" } }],
    [{ type: "response.completed", response }, { type: "response.completed", response }],
    [{ type: "response.completed", response }, { type: "text.delta", requestId: "turn-1", delta: "late" }],
    [{ type: "unknown", requestId: "turn-1" }],
  ].map((events) => ({ events })))("rejects malformed or invalid terminal stream behavior %j", async ({ events: script }) => {
    const events = await collect(new ElmoRuntime(streamBrain(script), new CapabilityRegistry()).run(turn, context));
    expect(events.at(-1)).toMatchObject({ type: "turn.failed", error: { code: "VALIDATION_ERROR" } });
    expect(events.some((event) => event.type === "turn.completed")).toBe(false);
  });

  it("maps a stream error to a terminal failure", async () => {
    const error = createElmoError("PROVIDER_ERROR", "Brain unavailable");
    const events = await collect(new ElmoRuntime(streamBrain([{ type: "error", requestId: "turn-1", error }]), new CapabilityRegistry()).run(turn, context));
    expect(events).toEqual([{ type: "turn.started", turnId: "turn-1" }, { type: "turn.failed", turnId: "turn-1", error }]);
  });

  it("normalizes exceptions during stream iteration", async () => {
    const brain: BrainProvider = { ...responseBrain(null), async *stream() { yield { type: "text.delta", requestId: "turn-1", delta: "partial" }; throw new Error("private sdk secret"); } };
    const events = await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, context));
    expect(events.map((event) => event.type)).toEqual(["turn.started", "text.delta", "turn.failed"]);
    expect(events.at(-1)).toMatchObject({ error: { code: "PROVIDER_ERROR" } });
    expect(JSON.stringify(events)).not.toMatch(/private|sdk|secret|stack/);
  });

  it("resolves and executes validated capability input only in Runtime with the same context and correlation", async () => {
    const calls: { input: JsonValue; context: ExecutionContext }[] = [];
    const registry = new CapabilityRegistry();
    expect(registry.register(capability({ async execute(input, local) { calls.push({ input, context: local }); return { ok: true, value: input }; } })).ok).toBe(true);
    const brain = new MockBrain({ response: { text: "Hello", capabilityRequests: [capabilityRequest] } });
    const request: BrainRequest = { requestId: "turn-1", turnId: "turn-1", messages: [{ role: "user", text: "Hi" }] };
    await brain.respond(request, context);
    registry.resolve("test.echo");
    expect(calls).toEqual([]);
    const events = await collect(new ElmoRuntime(brain, registry).run(turn, context));
    expect(events.map((event) => event.type)).toEqual(["turn.started", "capability.result", "turn.completed"]);
    expect(events[1]).toEqual({ type: "capability.result", turnId: "turn-1", result: { requestId: "cap-1", capabilityId: "test.echo", ok: true, output: "value" } });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("value");
    expect(calls[0].context).toBe(context);
  });

  it("emits a correlated NOT_FOUND result for unknown capabilities and completes", async () => {
    const events = await collect(capabilityRuntime([]).run(turn, context));
    expect(events[1]).toMatchObject({ type: "capability.result", result: { requestId: "cap-1", capabilityId: "test.echo", ok: false, error: { code: "NOT_FOUND" } } });
    expect(events.at(-1)?.type).toBe("turn.completed");
  });

  it("rejects invalid input without executing", async () => {
    let calls = 0;
    const definition = capability({ inputSchema: z.number(), async execute(input) { calls++; return { ok: true, value: input }; } });
    const events = await collect(capabilityRuntime([definition]).run(turn, context));
    expect(events[1]).toMatchObject({ type: "capability.result", result: { ok: false, error: { code: "VALIDATION_ERROR" } } });
    expect(calls).toBe(0);
    expect(events.at(-1)?.type).toBe("turn.completed");
  });

  it.each([
    { scopes: ["test.read"], requiresConfirmation: false },
    { scopes: [], requiresConfirmation: true },
  ])("fails closed for unresolved permission %j without executing", async (permission) => {
    let calls = 0;
    const definition = capability({ permission, async execute(input) { calls++; return { ok: true, value: input }; } });
    const events = await collect(capabilityRuntime([definition]).run(turn, context));
    expect(events[1]).toMatchObject({ type: "capability.result", result: { ok: false, error: { code: "PERMISSION_DENIED" } } });
    expect(calls).toBe(0);
    expect(events.at(-1)?.type).toBe("turn.completed");
  });

  it("preserves a capability's deliberate public error without failing the turn", async () => {
    const error = createElmoError("EXECUTION_ERROR", "Capability could not execute", { details: { reason: "test" } });
    const events = await collect(capabilityRuntime([capability({ async execute() { return { ok: false, error }; } })]).run(turn, context));
    expect(events[1]).toEqual({ type: "capability.result", turnId: "turn-1", result: { requestId: "cap-1", capabilityId: "test.echo", ok: false, error } });
    expect(events.at(-1)?.type).toBe("turn.completed");
  });

  it("normalizes private capability exceptions without leaking them or failing the turn", async () => {
    const events = await collect(capabilityRuntime([capability({ async execute() { throw new Error("private sdk secret"); } })]).run(turn, context));
    expect(events[1]).toMatchObject({ type: "capability.result", result: { ok: false, error: { code: "EXECUTION_ERROR" } } });
    expect(events.at(-1)?.type).toBe("turn.completed");
    expect(JSON.stringify(events)).not.toMatch(/private|sdk|secret|stack/);
  });

  it.each([
    null, { ok: false, error: new Error("private secret") }, { ok: true, value: 42 },
    { ok: true, value: new Date(0) }, { ok: true, value: "value", extra: "secret" },
  ])("rejects invalid capability result/output %j without failing the turn", async (result) => {
    const events = await collect(capabilityRuntime([capability({ async execute() { return result as ContractResult<JsonValue>; } })]).run(turn, context));
    expect(events[1]).toMatchObject({ type: "capability.result", result: { ok: false, error: { code: "VALIDATION_ERROR" } } });
    expect(events.at(-1)?.type).toBe("turn.completed");
    expect(JSON.stringify(events)).not.toMatch(/private|secret|stack/);
  });

  it("executes sequentially, continues after failure, emits UI first, and never calls Brain again", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const firstEntered = new Promise<void>((resolve) => { entered = resolve; });
    const calls: string[] = [];
    let brainCalls = 0;
    const registry = new CapabilityRegistry();
    registry.register(capability({ async execute() { calls.push("first-start"); entered(); await gate; calls.push("first-end"); return { ok: false, error: createElmoError("EXECUTION_ERROR", "First failed") }; } }));
    registry.register(capability({ id: "test.next", async execute() { calls.push("second"); return { ok: true, value: "next" }; } }));
    const requests = [capabilityRequest, { requestId: "cap-2", capabilityId: "test.next", input: "two" }];
    const uiIntents: BrainResponse["uiIntents"] = [{ type: "message.show", payload: { text: "Visible" } }];
    const brain: BrainProvider = { id: "test-brain", async respond() { brainCalls++; return { ok: true, value: { ...response, capabilityRequests: requests, uiIntents } }; } };
    const pending = collect(new ElmoRuntime(brain, registry).run(turn, context));
    // Release even if an unimplemented Runtime completes without entering execute.
    await Promise.race([firstEntered, pending]);
    expect(calls).toEqual(["first-start"]);
    release();
    const events = await pending;
    expect(calls).toEqual(["first-start", "first-end", "second"]);
    expect(events.map((event) => event.type)).toEqual(["turn.started", "ui.intent", "capability.result", "capability.result", "turn.completed"]);
    expect(events[2]).toMatchObject({ result: { requestId: "cap-1", capabilityId: "test.echo", ok: false } });
    expect(events[3]).toMatchObject({ result: { requestId: "cap-2", capabilityId: "test.next", ok: true, output: "next" } });
    expect(brainCalls).toBe(1);
  });

  it("detects pre-abort without calling Brain", async () => {
    const controller = new AbortController(); controller.abort();
    let calls = 0;
    const brain: BrainProvider = { id: "test-brain", async respond() { calls++; return { ok: true, value: response }; } };
    const events = await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, { turnId: "turn-1", signal: controller.signal }));
    expect(events.map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
    expect(calls).toBe(0);
  });

  it.each(["respond", "stream"] as const)("cooperatively cancels pending Brain %s work", async (mode) => {
    const controller = new AbortController();
    const local = { turnId: "turn-1", signal: controller.signal };
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const mock = new MockBrain({ response: { text: "Hello" }, waitFor: new Promise<void>(() => {}) });
    const brain: BrainProvider = { id: "test-brain", async respond(request, current) { entered(); return mock.respond(request, current); } };
    if (mode === "stream") brain.stream = async function* (request, current) { entered(); yield* mock.stream(request, current); };
    const pending = collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, local));
    await started;
    controller.abort();
    expect((await pending).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
  });

  it("stops requesting stream events after cancellation between deltas", async () => {
    const controller = new AbortController();
    let pulls = 0;
    const brain: BrainProvider = { ...responseBrain(null), async *stream() {
      pulls++; yield { type: "text.delta", requestId: "turn-1", delta: "first" };
      pulls++; yield { type: "text.delta", requestId: "turn-1", delta: "second" };
      yield { type: "response.completed", response };
    } };
    const iterator = new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, { turnId: "turn-1", signal: controller.signal })[Symbol.asyncIterator]();
    expect((await iterator.next()).value.type).toBe("turn.started");
    expect((await iterator.next()).value.type).toBe("text.delta");
    controller.abort();
    expect((await iterator.next()).value).toEqual({ type: "turn.cancelled", turnId: "turn-1" });
    expect((await iterator.next()).done).toBe(true);
    expect(pulls).toBe(1);
  });

  it("detects cancellation while advancing a stream before emitting another event", async () => {
    const controller = new AbortController();
    const brain: BrainProvider = { ...responseBrain(null), async *stream() { controller.abort(); yield { type: "text.delta", requestId: "turn-1", delta: "late" }; } };
    expect((await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, { turnId: "turn-1", signal: controller.signal }))).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
  });

  it("cancels before capabilities when the consumer aborts after a UI intent", async () => {
    const controller = new AbortController();
    let calls = 0;
    const runtime = capabilityRuntime([capability({ async execute(input) { calls++; return { ok: true, value: input }; } })], [capabilityRequest], [{ type: "message.show", payload: { text: "Visible" } }]);
    const events: RuntimeEvent[] = [];
    for await (const event of runtime.run(turn, { turnId: "turn-1", signal: controller.signal })) {
      events.push(event); if (event.type === "ui.intent") controller.abort();
    }
    expect(events.map((event) => event.type)).toEqual(["turn.started", "ui.intent", "turn.cancelled"]);
    expect(calls).toBe(0);
  });

  it("cancels between capability results without starting the next capability", async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    const runtime = capabilityRuntime([
      capability({ async execute(input) { calls.push("first"); return { ok: true, value: input }; } }),
      capability({ id: "test.next", async execute(input) { calls.push("second"); return { ok: true, value: input }; } }),
    ], [capabilityRequest, { requestId: "cap-2", capabilityId: "test.next", input: "next" }]);
    const events: RuntimeEvent[] = [];
    for await (const event of runtime.run(turn, { turnId: "turn-1", signal: controller.signal })) {
      events.push(event); if (event.type === "capability.result") controller.abort();
    }
    expect(events.map((event) => event.type)).toEqual(["turn.started", "capability.result", "turn.cancelled"]);
    expect(calls).toEqual(["first"]);
  });

  it("cancels during cooperative capability execution without emitting its late result or completing", async () => {
    const controller = new AbortController();
    const local = { turnId: "turn-1", signal: controller.signal };
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const calls: string[] = [];
    const runtime = capabilityRuntime([
      capability({ async execute(_input, current) {
        calls.push("first"); expect(current).toBe(local); entered();
        await new Promise<void>((resolve) => current.signal?.addEventListener("abort", () => resolve(), { once: true }));
        return { ok: true, value: "late" };
      } }),
      capability({ id: "test.next", async execute(input) { calls.push("second"); return { ok: true, value: input }; } }),
    ], [capabilityRequest, { requestId: "cap-2", capabilityId: "test.next", input: "next" }]);
    const pending = collect(runtime.run(turn, local)); await started; controller.abort();
    expect((await pending).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
    expect(calls).toEqual(["first"]);
  });

  it("checks cancellation immediately before execute after input validation", async () => {
    const controller = new AbortController(); let calls = 0;
    const runtime = capabilityRuntime([capability({
      inputSchema: z.string().refine(() => { controller.abort(); return true; }),
      async execute(input) { calls++; return { ok: true, value: input }; },
    })]);
    expect((await collect(runtime.run(turn, { turnId: "turn-1", signal: controller.signal }))).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
    expect(calls).toBe(0);
  });

  it("cancels before completion when Brain aborts after a successful response", async () => {
    const controller = new AbortController();
    const brain: BrainProvider = { id: "test-brain", async respond() { controller.abort(); return { ok: true, value: response }; } };
    expect((await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, { turnId: "turn-1", signal: controller.signal }))).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
  });

  it("gives cancellation precedence over a Brain exception after abort", async () => {
    const controller = new AbortController();
    const brain: BrainProvider = { id: "test-brain", async respond() { controller.abort(); throw new Error("private secret"); } };
    expect((await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, { turnId: "turn-1", signal: controller.signal }))).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
  });

  it("maps deliberate Brain cancellation to turn.cancelled", async () => {
    const brain = responseBrain({ ok: false, error: createElmoError("CANCELLED", "Brain cancelled") });
    expect((await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, context))).map((event) => event.type)).toEqual(["turn.started", "turn.cancelled"]);
  });

  it.each(["input", "output"] as const)("rejects a capability schema that transforms %s into non-JSON data", async (field) => {
    let calls = 0;
    const nonJsonSchema = z.string().transform(() => new Date(0)) as unknown as z.ZodType<JsonValue>;
    const definition = capability({
      ...(field === "input" ? { inputSchema: nonJsonSchema } : { outputSchema: nonJsonSchema }),
      async execute() { calls++; return { ok: true, value: "value" }; },
    });
    const events = await collect(capabilityRuntime([definition]).run(turn, context));
    expect(events[1]).toMatchObject({ type: "capability.result", result: { ok: false, error: { code: "VALIDATION_ERROR" } } });
    expect(calls).toBe(field === "input" ? 0 : 1);
    expect(events.at(-1)?.type).toBe("turn.completed");
  });

  it("replays the same turn deterministically and isolates explicitly composed registries", async () => {
    const runtime = capabilityRuntime([capability()]);
    const first = await collect(runtime.run(turn, context));
    expect(await collect(runtime.run(turn, context))).toEqual(first);
    const other = await collect(capabilityRuntime([]).run(turn, context));
    expect(other[1]).toMatchObject({ result: { ok: false, error: { code: "NOT_FOUND" } } });
    expect(first[1]).toMatchObject({ result: { ok: true, output: "value" } });
  });

  it("imports only shared contracts, Zod, and Registry with no transport or visual coupling", () => {
    const source = readFileSync(new URL("../../src/elmo/runtime/elmo-runtime.ts", import.meta.url), "utf8");
    const file = ts.createSourceFile("elmo-runtime.ts", source, ts.ScriptTarget.Latest, true);
    function check(node: ts.Node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          expect(specifier.text === "zod" || specifier.text.startsWith("../contracts/") || specifier.text === "../registry/capability-registry").toBe(true);
        }
      }
      if (ts.isImportTypeNode(node) || ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
        throw new Error("Runtime must use static domain imports");
      }
      ts.forEachChild(node, check);
    }
    check(file);
  });

  it("emits only one terminal event even when failed stream cleanup throws privately", async () => {
    const brain: BrainProvider = { ...responseBrain(null), async *stream() {
      try { yield { type: "error", requestId: "turn-1", error: createElmoError("PROVIDER_ERROR", "Brain unavailable") }; }
      finally { throw new Error("private cleanup secret"); }
    } };
    const events = await collect(new ElmoRuntime(brain, new CapabilityRegistry()).run(turn, context));
    expect(events.map((event) => event.type)).toEqual(["turn.started", "turn.failed"]);
    expect(JSON.stringify(events)).not.toMatch(/private|cleanup|secret|stack/);
  });
});
