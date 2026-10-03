import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "../../src/elmo/contracts/events";
import { ElmoErrorSchema } from "../../src/elmo/contracts/errors";
import { InboxPortFake } from "./support/inbox-port-fake";

const event: EventEnvelope = {
  id: "event-1", type: "automation.delivered", timestamp: "2026-10-03T12:00:00Z",
  correlationId: "automation-1", payload: { text: "Pause" },
};

describe("InboxPortFake test support", () => {
  it("receives supplied envelopes in order without manufacturing metadata and isolates instances", async () => {
    const fake = new InboxPortFake();
    expect(fake.received).toEqual([]);
    expect(await fake.receive(event)).toEqual({ ok: true, value: undefined });
    expect(await fake.receive({ ...event, id: "event-2", payload: null })).toEqual({ ok: true, value: undefined });
    expect(fake.received).toEqual([
      { id: "event-1", type: "automation.delivered", timestamp: "2026-10-03T12:00:00Z", correlationId: "automation-1", payload: { text: "Pause" } },
      { id: "event-2", type: "automation.delivered", timestamp: "2026-10-03T12:00:00Z", correlationId: "automation-1", payload: null },
    ]);
    expect((new InboxPortFake()).received).toEqual([]);
  });

  it.each([
    { id: "" }, { type: "invalid type" }, { timestamp: "later" },
    { correlationId: "" }, { payload: { invalid: () => {} } }, { extra: true },
  ])("rejects malformed envelopes %j without appending", async (override) => {
    const fake = new InboxPortFake();
    await fake.receive(event);
    const result = await fake.receive({ ...event, ...override } as EventEnvelope);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected envelope rejection");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    expect(fake.received).toHaveLength(1);
  });

  it("stores validated snapshots and returns detached assertion data", async () => {
    const fake = new InboxPortFake();
    const input = { ...event, payload: { text: "Pause" } };
    let reads = 0;
    Object.defineProperty(input, "id", { enumerable: true, get: () => reads++ === 0 ? "event-1" : "changed" });
    await fake.receive(input);
    input.payload.text = "caller-mutated";
    expect(fake.received[0]).toEqual({
      id: "event-1", type: "automation.delivered", timestamp: "2026-10-03T12:00:00Z",
      correlationId: "automation-1", payload: { text: "Pause" },
    });
    const exposed = fake.received;
    (exposed[0].payload as { text: string }).text = "assertion-mutated";
    exposed.pop();
    expect(fake.received).toHaveLength(1);
    expect(fake.received[0].payload).toEqual({ text: "Pause" });
  });
});
