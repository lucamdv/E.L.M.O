import { z } from "zod";
import { BrainResponseSchema } from "./brain";
import { CapabilityResultSchema } from "./capability";
import { ElmoErrorSchema } from "./errors";
import { IdentifierSchema, JsonObjectSchema } from "./primitives";
import { UIIntentSchema } from "./ui-intent";

export const RuntimeTurnSchema = z.strictObject({
  id: IdentifierSchema,
  input: z.string().min(1),
  context: JsonObjectSchema.optional(),
});

/** Domain events only; framing and transport are adapter responsibilities. */
export const RuntimeEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("turn.started"), turnId: IdentifierSchema }),
  z.strictObject({ type: z.literal("text.delta"), turnId: IdentifierSchema, delta: z.string() }),
  z.strictObject({ type: z.literal("ui.intent"), turnId: IdentifierSchema, intent: UIIntentSchema }),
  z.strictObject({ type: z.literal("capability.result"), turnId: IdentifierSchema, result: CapabilityResultSchema }),
  z.strictObject({ type: z.literal("turn.completed"), turnId: IdentifierSchema, response: BrainResponseSchema }),
  z.strictObject({ type: z.literal("turn.failed"), turnId: IdentifierSchema, error: ElmoErrorSchema }),
  z.strictObject({ type: z.literal("turn.cancelled"), turnId: IdentifierSchema }),
]);

export type RuntimeTurn = z.infer<typeof RuntimeTurnSchema>;
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;
