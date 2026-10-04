import { z } from "zod";
import { IdentifierSchema } from "./primitives";

const ContractVersionSchema = z.number().int().positive();
const PersonaStatementSchema = z.string().trim().min(1);
const PersonaStatementListSchema = z.array(PersonaStatementSchema).min(1);

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

export type AssistantIdentity = z.infer<typeof AssistantIdentitySchema>;
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
