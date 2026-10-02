import { z } from "zod";
import { CapabilityRequestSchema } from "./capability";
import { ElmoErrorSchema, type ContractResult } from "./errors";
import { IdentifierSchema, JsonObjectSchema, type ExecutionContext } from "./primitives";
import { UIIntentSchema } from "./ui-intent";

export const BrainMessageSchema = z.strictObject({
  role: z.enum(["system", "user", "assistant"]),
  text: z.string().min(1),
});

export const BrainRequestSchema = z.strictObject({
  requestId: IdentifierSchema,
  turnId: IdentifierSchema,
  messages: z.array(BrainMessageSchema).min(1),
  context: JsonObjectSchema.optional(),
  stream: z.boolean().optional(),
});

export const BrainResponseSchema = z.strictObject({
  requestId: IdentifierSchema,
  text: z.string(),
  capabilityRequests: z.array(CapabilityRequestSchema).optional(),
  uiIntents: z.array(UIIntentSchema).optional(),
});

export const BrainStreamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text.delta"), requestId: IdentifierSchema, delta: z.string() }),
  z.strictObject({ type: z.literal("response.completed"), response: BrainResponseSchema }),
  z.strictObject({ type: z.literal("error"), requestId: IdentifierSchema, error: ElmoErrorSchema }),
]);

export type BrainMessage = z.infer<typeof BrainMessageSchema>;
export type BrainRequest = z.infer<typeof BrainRequestSchema>;
export type BrainResponse = z.infer<typeof BrainResponseSchema>;
export type BrainStreamEvent = z.infer<typeof BrainStreamEventSchema>;

export interface BrainProvider {
  readonly id: string;
  respond(request: BrainRequest, context: ExecutionContext): Promise<ContractResult<BrainResponse>>;
  stream?(request: BrainRequest, context: ExecutionContext): AsyncIterable<BrainStreamEvent>;
}
