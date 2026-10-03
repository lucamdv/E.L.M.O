import { z } from "zod";

export const IdentifierSchema = z.string().regex(/^\S+$/);
export const TimestampSchema = z.iso.datetime({ offset: true });
export const JsonValueSchema = z.json().refine((value) => {
  const ancestors = new WeakSet<object>();
  // Track only the current path: reuse in a separate acyclic branch is valid JSON.
  function isAcyclic(node: unknown): boolean {
    if (node === null || typeof node !== "object") return true;
    if (ancestors.has(node)) return false;
    ancestors.add(node);
    const valid = Object.values(node).every(isAcyclic);
    ancestors.delete(node);
    return valid;
  }
  return isAcyclic(value);
}, { message: "JSON values must not contain cycles" });
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;

/** Local execution only; this context is never a serialized envelope. */
export interface ExecutionContext {
  turnId: string;
  signal?: AbortSignal;
}
