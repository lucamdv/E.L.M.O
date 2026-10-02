import { z } from "zod";
import { IdentifierSchema } from "./primitives";

/** Semantic requests only. The UI owns rendering and escaping of text. */
export const UIIntentRegistry = {
  "message.show": z.strictObject({
    type: z.literal("message.show"),
    payload: z.strictObject({ text: z.string().min(1) }),
  }),
  "context.focus": z.strictObject({
    type: z.literal("context.focus"),
    payload: z.strictObject({ contextId: IdentifierSchema }),
  }),
} as const;

export const UIIntentSchema = z.discriminatedUnion("type", [
  UIIntentRegistry["message.show"],
  UIIntentRegistry["context.focus"],
]);

export type UIIntent = z.infer<typeof UIIntentSchema>;
