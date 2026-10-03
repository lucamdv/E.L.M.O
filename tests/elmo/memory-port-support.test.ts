import { describe, expect, it } from "vitest";
import { ElmoErrorSchema } from "../../src/elmo/contracts/errors";
import type { MemoryContextQuery, MemoryRecord } from "../../src/elmo/contracts/memory";
import type { JsonValue } from "../../src/elmo/contracts/primitives";
import { MemoryPortFake } from "./support/memory-port-fake";

// These are test-infrastructure policies, not requirements on future Memory adapters.
describe("MemoryPortFake test support", () => {
  it("stores supplied records, retrieves them, and returns null for absent ids", async () => {
    const fake = new MemoryPortFake();
    expect(await fake.store({ id: "memory-1", content: { preference: "quiet" } })).toEqual({
      ok: true, value: { id: "memory-1", content: { preference: "quiet" } },
    });
    expect(await fake.retrieve("memory-1")).toEqual({
      ok: true, value: { id: "memory-1", content: { preference: "quiet" } },
    });
    expect(await fake.retrieve("missing")).toEqual({ ok: true, value: null });
    expect(await (new MemoryPortFake()).retrieve("memory-1")).toEqual({ ok: true, value: null });
  });

  it.each([{ id: "" }, { content: { invalid: undefined } }, { extra: true }])(
    "rejects malformed stored records %j without replacing an existing record", async (override) => {
      const fake = new MemoryPortFake();
      await fake.store({ id: "memory-1", content: "original" });
      const result = await fake.store({ id: "memory-1", content: "changed", ...override } as MemoryRecord);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected validation error");
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
      expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: { id: "memory-1", content: "original" } });
    },
  );

  it("snapshots input and returned records so caller mutation cannot change test storage", async () => {
    const fake = new MemoryPortFake();
    const input = { id: "memory-1", content: { tags: ["original"] } };
    const stored = await fake.store(input);
    input.content.tags.push("input-mutation");
    if (!stored.ok) throw new Error("Expected store success");
    (stored.value.content as { tags: string[] }).tags.push("store-result-mutation");
    const retrieved = await fake.retrieve("memory-1");
    expect(retrieved).toEqual({ ok: true, value: { id: "memory-1", content: { tags: ["original"] } } });
    if (!retrieved.ok || !retrieved.value) throw new Error("Expected record");
    (retrieved.value.content as { tags: string[] }).tags.push("retrieve-result-mutation");
    expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: { id: "memory-1", content: { tags: ["original"] } } });
  });

  it("uses the validated record id when the input getter changes", async () => {
    const fake = new MemoryPortFake();
    let reads = 0;
    const input = { id: "memory-1", content: "saved" };
    Object.defineProperty(input, "id", { enumerable: true, get: () => reads++ === 0 ? "memory-1" : "changed" });
    expect(await fake.store(input)).toEqual({ ok: true, value: { id: "memory-1", content: "saved" } });
    expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: { id: "memory-1", content: "saved" } });
    expect(await fake.retrieve("changed")).toEqual({ ok: true, value: null });
  });

  it("updates and forgets known records with NOT_FOUND for unknown ids", async () => {
    const fake = new MemoryPortFake();
    await fake.store({ id: "memory-1", content: "original" });
    expect(await fake.update("memory-1", ["updated", null])).toEqual({ ok: true, value: { id: "memory-1", content: ["updated", null] } });
    expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: { id: "memory-1", content: ["updated", null] } });
    expect(await fake.forget("memory-1")).toEqual({ ok: true, value: undefined });
    expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: null });
    for (const result of [await fake.update("missing", "value"), await fake.forget("missing")]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected unknown-id failure");
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.retryable).toBe(false);
      expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    }
  });

  it("returns insertion-order context with an optional limit without interpreting the query", async () => {
    const fake = new MemoryPortFake();
    expect(await fake.getContext({ query: "anything" })).toEqual({ ok: true, value: [] });
    await fake.store({ id: "second", content: "two" });
    await fake.store({ id: "first", content: "one" });
    await fake.store({ id: "second", content: "replacement" });
    await fake.store({ id: "third", content: "three" });
    expect(await fake.getContext({ query: "no match" })).toEqual({ ok: true, value: [
      { id: "second", content: "replacement" }, { id: "first", content: "one" }, { id: "third", content: "three" },
    ] });
    expect(await fake.getContext({ query: "unrelated", limit: 2 })).toEqual({ ok: true, value: [
      { id: "second", content: "replacement" }, { id: "first", content: "one" },
    ] });
  });

  it.each([{ query: "" }, { query: "valid", limit: 0 }, { query: "valid", limit: 1.5 }, { query: "valid", extra: true }])(
    "validates context queries %j", async (query) => {
      const fake = new MemoryPortFake();
      const result = await fake.getContext(query as MemoryContextQuery);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected query validation error");
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    },
  );

  it.each(["", "invalid id"])("validates ids %j for read/update/forget", async (id) => {
    const fake = new MemoryPortFake();
    for (const result of [await fake.retrieve(id), await fake.update(id, null), await fake.forget(id)]) {
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected id validation error");
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(ElmoErrorSchema.safeParse(result.error).success).toBe(true);
    }
  });

  it("rejects non-JSON updates without corrupting the stored record", async () => {
    const fake = new MemoryPortFake();
    await fake.store({ id: "memory-1", content: "original" });
    const result = await fake.update("memory-1", (() => "do not execute") as unknown as JsonValue);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected content validation error");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: { id: "memory-1", content: "original" } });
  });

  it("keeps update and context results detached from storage", async () => {
    const fake = new MemoryPortFake();
    await fake.store({ id: "memory-1", content: null });
    const input = { tags: ["updated"] };
    const result = await fake.update("memory-1", input);
    input.tags.push("input-mutated");
    if (!result.ok) throw new Error("Expected update success");
    (result.value.content as { tags: string[] }).tags.push("result-mutated");
    const context = await fake.getContext({ query: "anything" });
    expect(context).toEqual({ ok: true, value: [{ id: "memory-1", content: { tags: ["updated"] } }] });
    if (!context.ok) throw new Error("Expected context success");
    (context.value[0].content as { tags: string[] }).tags.push("context-mutated");
    context.value.pop();
    expect(await fake.retrieve("memory-1")).toEqual({ ok: true, value: { id: "memory-1", content: { tags: ["updated"] } } });
  });
});
