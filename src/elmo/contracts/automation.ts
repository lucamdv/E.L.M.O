import { z } from "zod";
import { IdentifierSchema, JsonObjectSchema, JsonValueSchema } from "./primitives";

/** Extension points are typed envelopes, not an execution language. */
export const AutomationTriggerSchema = z.strictObject({ type: IdentifierSchema, config: JsonObjectSchema });
export const AutomationConditionSchema = AutomationTriggerSchema;
export const AutomationDeliverySchema = AutomationTriggerSchema;
export const AutomationActionSchema = z.strictObject({ capabilityId: IdentifierSchema, input: JsonValueSchema });

export const AutomationDefinitionSchema = z.strictObject({
  id: IdentifierSchema,
  trigger: AutomationTriggerSchema,
  condition: AutomationConditionSchema.optional(),
  action: AutomationActionSchema,
  delivery: AutomationDeliverySchema,
});

export type AutomationTrigger = z.infer<typeof AutomationTriggerSchema>;
export type AutomationCondition = z.infer<typeof AutomationConditionSchema>;
export type AutomationAction = z.infer<typeof AutomationActionSchema>;
export type AutomationDelivery = z.infer<typeof AutomationDeliverySchema>;
export type AutomationDefinition = z.infer<typeof AutomationDefinitionSchema>;
