import { z } from "zod";
import type { ContractResult } from "./errors";
import { IdentifierSchema, JsonValueSchema, type JsonValue } from "./primitives";

export const MemoryRecordSchema = z.strictObject({ id: IdentifierSchema, content: JsonValueSchema });
export const MemoryContextQuerySchema = z.strictObject({ query: z.string().min(1), limit: z.number().int().positive().optional() });

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export type MemoryContextQuery = z.infer<typeof MemoryContextQuerySchema>;

/** Storage policy, ranking, retention, and tenancy belong to future adapters. */
export interface MemoryPort {
  store(record: MemoryRecord): Promise<ContractResult<MemoryRecord>>;
  retrieve(id: string): Promise<ContractResult<MemoryRecord | null>>;
  update(id: string, content: JsonValue): Promise<ContractResult<MemoryRecord>>;
  forget(id: string): Promise<ContractResult<void>>;
  getContext(query: MemoryContextQuery): Promise<ContractResult<MemoryRecord[]>>;
}
