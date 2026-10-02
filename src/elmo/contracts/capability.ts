import { z } from "zod";
import { ElmoErrorSchema, type ContractResult } from "./errors";
import { IdentifierSchema, JsonValueSchema, type ExecutionContext, type JsonValue } from "./primitives";

export const CapabilityRequestSchema = z.strictObject({
  requestId: IdentifierSchema,
  capabilityId: IdentifierSchema,
  input: JsonValueSchema,
});

export const CapabilityPermissionSchema = z.strictObject({
  scopes: z.array(IdentifierSchema),
  requiresConfirmation: z.boolean(),
});

export const CapabilityResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    requestId: IdentifierSchema, capabilityId: IdentifierSchema,
    ok: z.literal(true), output: JsonValueSchema,
  }),
  z.strictObject({
    requestId: IdentifierSchema, capabilityId: IdentifierSchema,
    ok: z.literal(false), error: ElmoErrorSchema,
  }),
]);

export type CapabilityRequest = z.infer<typeof CapabilityRequestSchema>;
export type CapabilityPermission = z.infer<typeof CapabilityPermissionSchema>;
export type CapabilityResult = z.infer<typeof CapabilityResultSchema>;

/** Local definition; schemas and execute are not serialized with a request. */
export interface CapabilityDefinition<Input extends JsonValue = JsonValue, Output extends JsonValue = JsonValue> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<Input>;
  readonly outputSchema: z.ZodType<Output>;
  readonly permission: CapabilityPermission;
  execute(input: Input, context: ExecutionContext): Promise<ContractResult<Output>>;
}
