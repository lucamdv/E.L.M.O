import { z } from "zod";
import { CapabilityPermissionSchema, type CapabilityDefinition } from "../contracts/capability";
import { createElmoError, validateContract, type ContractResult } from "../contracts/errors";
import { IdentifierSchema } from "../contracts/primitives";

// Validate local definitions without parsing capability inputs or outputs.
const DefinitionSchema = z.object({
  id: IdentifierSchema,
  description: z.string(),
  inputSchema: z.instanceof(z.ZodType),
  outputSchema: z.instanceof(z.ZodType),
  permission: CapabilityPermissionSchema,
  execute: z.custom<CapabilityDefinition["execute"]>((value) => typeof value === "function"),
});

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition): ContractResult<void> {
    const validated = validateContract(DefinitionSchema, definition);
    if (!validated.ok) return validated;
    if (this.has(definition.id)) {
      return { ok: false, error: createElmoError("VALIDATION_ERROR", "Capability id is already registered", { details: { capabilityId: definition.id } }) };
    }
    // Snapshot caller-owned metadata; preserve schemas and executor by reference.
    const permission = validated.value.permission;
    Object.freeze(permission.scopes);
    Object.freeze(permission);
    this.definitions.set(definition.id, Object.freeze({
      id: validated.value.id,
      description: validated.value.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      permission,
      execute: definition.execute,
    }));
    return { ok: true, value: undefined };
  }

  resolve(id: string): ContractResult<CapabilityDefinition> {
    const definition = this.definitions.get(id);
    return definition
      ? { ok: true, value: definition }
      : { ok: false, error: createElmoError("NOT_FOUND", "Capability is not registered", { details: { capabilityId: id } }) };
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.definitions.values()];
  }
}
