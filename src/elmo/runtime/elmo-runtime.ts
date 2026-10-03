import { z } from "zod";
import { BrainResponseSchema, BrainStreamEventSchema, type BrainProvider, type BrainRequest, type BrainResponse } from "../contracts/brain";
import type { CapabilityRequest, CapabilityResult } from "../contracts/capability";
import { createElmoError, ElmoErrorSchema, validateContract } from "../contracts/errors";
import { IdentifierSchema, JsonValueSchema, type ExecutionContext } from "../contracts/primitives";
import { RuntimeTurnSchema, type RuntimeEvent } from "../contracts/runtime";
import type { CapabilityRegistry } from "../registry/capability-registry";

const BrainResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), value: BrainResponseSchema }),
  z.strictObject({ ok: z.literal(false), error: ElmoErrorSchema }),
]);
const ExecutionResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), value: JsonValueSchema }),
  z.strictObject({ ok: z.literal(false), error: ElmoErrorSchema }),
]);

function checkCancellation(context: ExecutionContext): void {
  if (context.signal?.aborted) throw createElmoError("CANCELLED", "Turn cancelled");
}

export class ElmoRuntime {
  constructor(private readonly brain: BrainProvider, private readonly registry: CapabilityRegistry) {}

  async *run(turn: unknown, context: ExecutionContext): AsyncIterable<RuntimeEvent> {
    let turnId = "invalid-turn";
    let terminalEmitted = false;
    let failureCode: "INTERNAL_ERROR" | "PROVIDER_ERROR" = "INTERNAL_ERROR";
    try {
      const localId = IdentifierSchema.safeParse(context.turnId);
      if (localId.success) turnId = localId.data;
      const parsed = validateContract(RuntimeTurnSchema, turn);
      if (!parsed.ok) {
        yield { type: "turn.failed", turnId, error: parsed.error };
        return;
      }
      const validated = parsed.value;
      turnId = validated.id;
      if (context.turnId !== turnId) {
        yield { type: "turn.failed", turnId, error: createElmoError("VALIDATION_ERROR", "Execution context does not match turn") };
        return;
      }
      yield { type: "turn.started", turnId };
      checkCancellation(context);
      const request: BrainRequest = {
        requestId: turnId, turnId,
        messages: [{ role: "user", text: validated.input }],
        ...(validated.context === undefined ? {} : { context: validated.context }),
        ...(this.brain.stream ? { stream: true } : {}),
      };
      failureCode = "PROVIDER_ERROR";
      let response: BrainResponse | undefined;
      if (this.brain.stream) {
        for await (const raw of this.brain.stream(request, context)) {
          checkCancellation(context);
          const parsed = validateContract(BrainStreamEventSchema, raw);
          if (!parsed.ok) {
            terminalEmitted = true;
            yield { type: "turn.failed", turnId, error: parsed.error };
            return;
          }
          const event = parsed.value;
          const eventId = event.type === "response.completed" ? event.response.requestId : event.requestId;
          if (response || eventId !== request.requestId) {
            terminalEmitted = true;
            yield { type: "turn.failed", turnId, error: createElmoError("VALIDATION_ERROR", "Invalid Brain stream sequence or correlation") };
            return;
          }
          if (event.type === "error") {
            terminalEmitted = true;
            if (event.error.code === "CANCELLED") {
              yield { type: "turn.cancelled", turnId };
              return;
            }
            yield { type: "turn.failed", turnId, error: event.error };
            return;
          }
          if (event.type === "text.delta") yield { type: "text.delta", turnId, delta: event.delta };
          else response = event.response;
          checkCancellation(context);
        }
        checkCancellation(context);
        if (!response) {
          yield { type: "turn.failed", turnId, error: createElmoError("VALIDATION_ERROR", "Brain stream ended without a response") };
          return;
        }
      } else {
        const raw = await this.brain.respond(request, context);
        checkCancellation(context);
        const result = validateContract(BrainResultSchema, raw);
        const normalized = result.ok ? result.value : result;
        if (!normalized.ok) {
          const error = normalized.error;
          if (error.code === "CANCELLED") yield { type: "turn.cancelled", turnId };
          else yield { type: "turn.failed", turnId, error };
          return;
        }
        response = normalized.value;
      }
      if (response.requestId !== request.requestId) {
        yield { type: "turn.failed", turnId, error: createElmoError("VALIDATION_ERROR", "Brain response correlation does not match") };
        return;
      }
      failureCode = "INTERNAL_ERROR";
      for (const intent of response.uiIntents ?? []) {
        checkCancellation(context);
        yield { type: "ui.intent", turnId, intent };
      }
      for (const requested of response.capabilityRequests ?? []) {
        checkCancellation(context);
        const result = await this.execute(requested, context);
        checkCancellation(context);
        yield { type: "capability.result", turnId, result };
      }
      checkCancellation(context);
      yield { type: "turn.completed", turnId, response };
    } catch {
      // A stream's return/cleanup may throw after its terminal event was emitted.
      if (terminalEmitted) return;
      if (context.signal?.aborted) yield { type: "turn.cancelled", turnId };
      else yield { type: "turn.failed", turnId, error: createElmoError(failureCode, "Runtime operation failed") };
    }
  }

  private async execute(request: CapabilityRequest, context: ExecutionContext): Promise<CapabilityResult> {
    const correlation = { requestId: request.requestId, capabilityId: request.capabilityId };
    try {
      const resolved = this.registry.resolve(request.capabilityId);
      if (!resolved.ok) return { ...correlation, ok: false, error: resolved.error };
      const definition = resolved.value;
      if (definition.permission.scopes.length || definition.permission.requiresConfirmation) {
        return { ...correlation, ok: false, error: createElmoError("PERMISSION_DENIED", "Capability requires unresolved authorization") };
      }
      const input = validateContract(definition.inputSchema, request.input);
      if (!input.ok) return { ...correlation, ok: false, error: input.error };
      const jsonInput = validateContract(JsonValueSchema, input.value);
      if (!jsonInput.ok) return { ...correlation, ok: false, error: jsonInput.error };
      checkCancellation(context);
      const result = validateContract(ExecutionResultSchema, await definition.execute(jsonInput.value, context));
      checkCancellation(context);
      if (!result.ok) return { ...correlation, ok: false, error: result.error };
      if (!result.value.ok) return { ...correlation, ok: false, error: result.value.error };
      const output = validateContract(definition.outputSchema, result.value.value);
      if (!output.ok) return { ...correlation, ok: false, error: output.error };
      const jsonOutput = validateContract(JsonValueSchema, output.value);
      if (!jsonOutput.ok) return { ...correlation, ok: false, error: jsonOutput.error };
      return { ...correlation, ok: true, output: jsonOutput.value };
    } catch {
      return { ...correlation, ok: false, error: createElmoError("EXECUTION_ERROR", "Capability execution failed") };
    }
  }
}
