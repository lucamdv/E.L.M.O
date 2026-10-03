import { z } from "zod";
import { JsonObjectSchema, type JsonObject } from "./primitives";

export const ElmoErrorCodeSchema = z.enum([
  "VALIDATION_ERROR", "NOT_FOUND", "PERMISSION_DENIED", "CANCELLED",
  "PROVIDER_ERROR", "EXECUTION_ERROR", "INTERNAL_ERROR",
]);

export const ElmoErrorSchema = z.strictObject({
  code: ElmoErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  details: JsonObjectSchema.optional(),
});

export type ElmoError = z.infer<typeof ElmoErrorSchema>;
export type ElmoErrorCode = z.infer<typeof ElmoErrorCodeSchema>;
export type ContractResult<T> = { ok: true; value: T } | { ok: false; error: ElmoError };

export function createElmoError(
  code: ElmoErrorCode,
  message: string,
  options: { retryable?: boolean; details?: JsonObject } = {},
): ElmoError {
  return ElmoErrorSchema.parse({ code, message, ...options, retryable: options.retryable ?? false });
}

/** Preserve deliberate public errors; do not expose arbitrary exceptions. */
export function toElmoError(error: unknown): ElmoError {
  try {
    const isNativeError =
      error instanceof Error || Object.prototype.toString.call(error) === "[object Error]";
    if (isNativeError) {
      return createElmoError("INTERNAL_ERROR", "An unexpected error occurred");
    }
    const parsed = ElmoErrorSchema.safeParse(error);
    return parsed.success
      ? parsed.data
      : createElmoError("INTERNAL_ERROR", "An unexpected error occurred");
  } catch {
    return createElmoError("INTERNAL_ERROR", "An unexpected error occurred");
  }
}

export function validateContract<T>(schema: z.ZodType<T>, input: unknown): ContractResult<T> {
  try {
    const parsed = schema.safeParse(input);
    if (parsed.success) return { ok: true, value: parsed.data };
    return {
      ok: false,
      error: createElmoError("VALIDATION_ERROR", "Contract validation failed", {
        details: {
          issues: parsed.error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path.map((part) => typeof part === "symbol" ? String(part) : part),
          })),
        },
      }),
    };
  } catch {
    return { ok: false, error: createElmoError("INTERNAL_ERROR", "An unexpected error occurred") };
  }
}
