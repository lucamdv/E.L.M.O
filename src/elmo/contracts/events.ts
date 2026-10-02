import { z } from "zod";
import type { ContractResult } from "./errors";
import { IdentifierSchema, JsonValueSchema, TimestampSchema, type JsonValue } from "./primitives";

export const EventEnvelopeSchema = z.strictObject({
  id: IdentifierSchema,
  type: IdentifierSchema,
  timestamp: TimestampSchema,
  correlationId: IdentifierSchema.optional(),
  payload: JsonValueSchema,
});

export type EventEnvelope<Payload extends JsonValue = JsonValue> = Omit<z.infer<typeof EventEnvelopeSchema>, "payload"> & { payload: Payload };
export type EventHandler = (event: EventEnvelope) => void | Promise<void>;

/** No guarantees about storage, retries, ordering, or delivery lifecycle. */
export interface EventBus {
  publish(event: EventEnvelope): Promise<ContractResult<void>>;
  subscribe(type: string, handler: EventHandler): () => void;
}

export interface InboxPort {
  receive(event: EventEnvelope): Promise<ContractResult<void>>;
}
