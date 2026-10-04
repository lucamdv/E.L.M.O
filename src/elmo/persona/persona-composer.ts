import { validateContract, type ContractResult } from "../contracts/errors";
import { BehavioralContextSchema, type BehavioralContext } from "../contracts/persona";

/** Compose validated persona layers without deriving prompts or hidden defaults. */
export function composePersonaContext(input: unknown): ContractResult<BehavioralContext> {
  return validateContract(BehavioralContextSchema, input);
}
