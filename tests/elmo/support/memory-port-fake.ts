import { MemoryContextQuerySchema, MemoryRecordSchema, type MemoryContextQuery, type MemoryPort, type MemoryRecord } from "../../../src/elmo/contracts/memory";
import { createElmoError, validateContract, type ContractResult } from "../../../src/elmo/contracts/errors";
import { IdentifierSchema, type JsonValue } from "../../../src/elmo/contracts/primitives";

/** Deterministic test storage; these policies do not define product memory behavior. */
export class MemoryPortFake implements MemoryPort {
  private readonly records = new Map<string, MemoryRecord>();

  async store(record: MemoryRecord): Promise<ContractResult<MemoryRecord>> {
    const validated = validateContract(MemoryRecordSchema, record);
    if (!validated.ok) return validated;
    this.records.set(validated.value.id, validated.value);
    return { ok: true, value: structuredClone(validated.value) };
  }

  async retrieve(id: string): Promise<ContractResult<MemoryRecord | null>> {
    const validated = validateContract(IdentifierSchema, id);
    if (!validated.ok) return validated;
    return { ok: true, value: structuredClone(this.records.get(validated.value) ?? null) };
  }

  async update(id: string, content: JsonValue): Promise<ContractResult<MemoryRecord>> {
    const validated = validateContract(MemoryRecordSchema, { id, content });
    if (!validated.ok) return validated;
    if (!this.records.has(validated.value.id)) return { ok: false, error: createElmoError("NOT_FOUND", "Test memory record was not found") };
    return this.store(validated.value);
  }

  async forget(id: string): Promise<ContractResult<void>> {
    const validated = validateContract(IdentifierSchema, id);
    if (!validated.ok) return validated;
    if (!this.records.delete(validated.value)) return { ok: false, error: createElmoError("NOT_FOUND", "Test memory record was not found") };
    return { ok: true, value: undefined };
  }

  async getContext(query: MemoryContextQuery): Promise<ContractResult<MemoryRecord[]>> {
    const validated = validateContract(MemoryContextQuerySchema, query);
    if (!validated.ok) return validated;
    return { ok: true, value: structuredClone([...this.records.values()].slice(0, validated.value.limit)) };
  }
}
