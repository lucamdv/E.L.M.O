import { z } from "zod";

export const IdentifierSchema = z.string().regex(/^\S+$/);
export const TimestampSchema = z.iso.datetime({ offset: true });
export const JsonValueSchema = z.json();
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;

/** Local execution only; this context is never a serialized envelope. */
export interface ExecutionContext {
  turnId: string;
  signal?: AbortSignal;
}
