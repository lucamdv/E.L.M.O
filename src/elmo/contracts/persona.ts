import { z } from "zod";
import { IdentifierSchema } from "./primitives";

const ContractVersionSchema = z.number().int().positive();
const PersonaStatementSchema = z.string().trim().min(1);
const PersonaStatementListSchema = z.array(PersonaStatementSchema).min(1);
const PreferenceIntensitySchema = z.enum(["low", "balanced", "high"]);
const LanguageTagSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);
const hasNoExplicitUndefined = (value: object) => Object.values(value).every((entry) => entry !== undefined);
const ExplicitUndefinedIssue = { message: "Optional fields must be omitted instead of undefined" };

/** Stable identity only; behavior belongs to PersonaProfile. */
export const AssistantIdentitySchema = z.strictObject({
  id: IdentifierSchema,
  displayName: PersonaStatementSchema,
  version: ContractVersionSchema,
});

/** Versioned behavioral defaults and invariants for an assistant identity. */
export const PersonaProfileSchema = z.strictObject({
  identityId: IdentifierSchema,
  version: ContractVersionSchema,
  traits: PersonaStatementListSchema,
  relationalRole: PersonaStatementSchema,
  communicationDefaults: PersonaStatementListSchema,
  behaviorDefaults: PersonaStatementListSchema,
  principles: PersonaStatementListSchema,
});

/** Optional user-specific interaction preferences; PersonaProfile owns defaults. */
export const RelationalPreferencesSchema = z.strictObject({
  preferredFormOfAddress: PersonaStatementSchema.optional(),
  formality: z.enum(["informal", "balanced", "formal"]).optional(),
  humorIntensity: PreferenceIntensitySchema.optional(),
  humorStyles: z.array(z.enum(["observational", "absurd", "inside-jokes"])).min(1).optional(),
  verbosity: z.enum(["concise", "balanced", "detailed"]).optional(),
  profanityEnabled: z.boolean().optional(),
  visualExpressiveness: PreferenceIntensitySchema.optional(),
}).refine(hasNoExplicitUndefined, ExplicitUndefinedIssue);

/** Transient signals for the current interaction; no preferences or persistence. */
export const InteractionContextSchema = z.strictObject({
  languageTag: LanguageTagSchema.optional(),
  seriousness: z.enum(["casual", "neutral", "serious"]).optional(),
  urgency: z.enum(["low", "normal", "high"]).optional(),
  taskMode: z.enum(["quick", "explanatory", "brainstorming"]).optional(),
  userAffect: z.enum(["neutral", "positive", "frustrated", "sad", "anxious", "angry"]).optional(),
}).refine(hasNoExplicitUndefined, ExplicitUndefinedIssue);

/** Provider-neutral composition of stable, relational, and transient persona layers. */
export const BehavioralContextSchema = z.strictObject({
  identity: AssistantIdentitySchema,
  personaProfile: PersonaProfileSchema,
  relationalPreferences: RelationalPreferencesSchema,
  interactionContext: InteractionContextSchema,
}).superRefine((value, context) => {
  if (value.personaProfile.identityId !== value.identity.id) {
    context.addIssue({
      code: "custom",
      path: ["personaProfile", "identityId"],
      message: "Persona profile must belong to the composed assistant identity",
    });
  }
});

export type AssistantIdentity = z.infer<typeof AssistantIdentitySchema>;
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
export type RelationalPreferences = z.infer<typeof RelationalPreferencesSchema>;
export type InteractionContext = z.infer<typeof InteractionContextSchema>;
export type BehavioralContext = z.infer<typeof BehavioralContextSchema>;
