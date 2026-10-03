import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "../../src/elmo/contracts/events";
import { createElmoError, ElmoErrorSchema } from "../../src/elmo/contracts/errors";
import { LocalEventBus } from "../../src/elmo/events/local-event-bus";

const event: EventEnvelope = {
  id: "event-1", type: "memory.updated", timestamp: "2026-10-03T12:00:00Z",
  correlationId: "turn-1", payload: { id: "memory-1" },
};

describe("LocalEventBus", () => {
  it("delivers a complete envelope unchanged to its matching synchronous handler", async () => {
    const instance = new LocalEventBus();
    const received: EventEnvelope[] = [];
    instance.subscribe("memory.updated", (value) => { received.push(value); });
    expect(await instance.publish(event)).toEqual({ ok: true, value: undefined });
    expect(received).toEqual([{
      id: "event-1", type: "memory.updated", timestamp: "2026-10-03T12:00:00Z",
      correlationId: "turn-1", payload: { id: "memory-1" },
    }]);
  });

  it.each([
    { id: "" }, { type: "invalid type" }, { timestamp: "later" },
    { correlationId: "" }, { payload: { invalid: undefined } }, { extra: true },
  ])("rejects an invalid envelope %j before any delivery", async (override) => {
    const instance = new LocalEventBus();
    const received: EventEnvelope[] = [];
    instance.subscribe("memory.updated", (value) => { received.push(value); });
    instance.subscribe("invalid type", (value) => { received.push(value); });
    const result = await instance.publish({ ...event, ...override } as EventEnvelope);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected envelope rejection");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    expect(received).toEqual([]);
  });

  it("uses the validated type and payload snapshot without rereading input getters", async () => {
    const instance = new LocalEventBus();
    const received: EventEnvelope[] = [];
    const wrongType: EventEnvelope[] = [];
    instance.subscribe("memory.updated", (value) => { received.push(value); });
    instance.subscribe("changed", (value) => { wrongType.push(value); });
    let reads = 0;
    const input = { ...event, payload: { id: "memory-1" } };
    Object.defineProperty(input, "type", { enumerable: true, get: () => reads++ === 0 ? "memory.updated" : "changed" });
    expect(await instance.publish(input)).toEqual({ ok: true, value: undefined });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("memory.updated");
    expect(received[0]).not.toBe(input);
    input.payload.id = "caller-mutated";
    expect(received[0].payload).toEqual({ id: "memory-1" });
    expect(wrongType).toEqual([]);
  });

  it("awaits asynchronous handlers in subscription order", async () => {
    const instance = new LocalEventBus();
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    instance.subscribe(event.type, async () => { order.push("first:start"); await gate; order.push("first:end"); });
    instance.subscribe(event.type, () => { order.push("second"); });
    const pending = instance.publish(event);
    expect(order).toEqual(["first:start"]);
    release();
    expect(await pending).toEqual({ ok: true, value: undefined });
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("unsubscribes each registration idempotently even for the same handler", async () => {
    const instance = new LocalEventBus();
    const received: string[] = [];
    const handler = () => { received.push("received"); };
    const removeFirst = instance.subscribe(event.type, handler);
    const removeSecond = instance.subscribe(event.type, handler);
    removeFirst();
    removeFirst();
    await instance.publish(event);
    expect(received).toEqual(["received"]);
    removeSecond();
    await instance.publish(event);
    expect(received).toEqual(["received"]);
  });

  it("isolates instances and event types and succeeds with no subscribers", async () => {
    const first = new LocalEventBus();
    const second = new LocalEventBus();
    const received: string[] = [];
    first.subscribe(event.type, () => { received.push("first"); });
    second.subscribe("other.type", () => { received.push("other"); });
    expect(await second.publish(event)).toEqual({ ok: true, value: undefined });
    expect(received).toEqual([]);
    await first.publish(event);
    expect(received).toEqual(["first"]);
  });

  it("does not let an old unsubscribe erase a later subscription for the same type", async () => {
    const instance = new LocalEventBus();
    const removed = instance.subscribe(event.type, () => {});
    removed();
    const received: string[] = [];
    instance.subscribe(event.type, () => { received.push("new"); });
    removed();
    await instance.publish(event);
    expect(received).toEqual(["new"]);
  });

  it.each(["sync", "async"])("normalizes a %s private handler failure and stops delivery", async (mode) => {
    const instance = new LocalEventBus();
    const order: string[] = [];
    const failure = Object.assign(new Error("private-token"), { secret: "private-data" });
    instance.subscribe(event.type, mode === "sync"
      ? () => { order.push("failed"); throw failure; }
      : async () => { order.push("failed"); await Promise.resolve(); throw failure; });
    instance.subscribe(event.type, () => { order.push("later"); });
    const result = await instance.publish(event).catch(() => undefined);
    expect(result).toEqual({ ok: false, error: {
      code: "INTERNAL_ERROR", message: "An unexpected error occurred", retryable: false,
    } });
    expect(order).toEqual(["failed"]);
    expect(JSON.stringify(result)).not.toMatch(/private|stack|secret/);
  });

  it("preserves an intentional public handler error", async () => {
    const instance = new LocalEventBus();
    const failure = createElmoError("EXECUTION_ERROR", "Handler could not complete", {
      retryable: true, details: { reason: "temporarily-unavailable" },
    });
    instance.subscribe(event.type, () => { throw failure; });
    const result = await instance.publish(event).catch(() => undefined);
    expect(result).toEqual({ ok: false, error: failure });
    expect(result && !result.ok && ElmoErrorSchema.safeParse(result.error).success).toBe(true);
  });
});
