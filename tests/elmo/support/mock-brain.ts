import { isDeepStrictEqual } from "node:util";
import { BrainResponseSchema, BrainStreamEventSchema, type BrainProvider, type BrainRequest, type BrainResponse, type BrainStreamEvent } from "../../../src/elmo/contracts/brain";
import { createElmoError, ElmoErrorSchema, toElmoError, validateContract, type ContractResult, type ElmoError } from "../../../src/elmo/contracts/errors";
import type { ExecutionContext } from "../../../src/elmo/contracts/primitives";

export interface MockBrainScript {
  response: Omit<BrainResponse, "requestId">;
  events?: BrainStreamEvent[];
  error?: ElmoError;
  /** A test-controlled gate, released by the test or interrupted by cancellation. */
  waitFor?: Promise<void>;
}

const cancelledError = () => createElmoError("CANCELLED", "Brain request cancelled");

/** Test infrastructure only: replays normalized scripts without product behavior. */
export class MockBrain implements BrainProvider {
  readonly id = "mock-brain";

  constructor(private readonly script: MockBrainScript) {}

  private async wait(signal?: AbortSignal): Promise<void> {
    const gate = this.script.waitFor;
    if (!gate) return;
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      gate.then(
        () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
        (error) => {
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
      );
    });
  }

  async respond(request: BrainRequest, context: ExecutionContext): Promise<ContractResult<BrainResponse>> {
    if (context.signal?.aborted) return { ok: false, error: cancelledError() };
    try {
      await this.wait(context.signal);
    } catch (error) {
      return { ok: false, error: toElmoError(error) };
    }
    if (context.signal?.aborted) return { ok: false, error: cancelledError() };
    if (this.script.error) {
      const result = validateContract(ElmoErrorSchema, this.script.error);
      return { ok: false, error: result.ok ? result.value : result.error };
    }
    return validateContract(BrainResponseSchema, { ...this.script.response, requestId: request.requestId });
  }

  async *stream(request: BrainRequest, context: ExecutionContext): AsyncIterable<BrainStreamEvent> {
    const initial = await this.respond(request, context);
    if (!initial.ok) {
      yield { type: "error", requestId: request.requestId, error: initial.error };
      return;
    }
    for (const event of this.script.events ?? []) {
      if (context.signal?.aborted) {
        yield { type: "error", requestId: request.requestId, error: cancelledError() };
        return;
      }
      const parsed = validateContract(BrainStreamEventSchema, event);
      if (!parsed.ok) {
        yield { type: "error", requestId: request.requestId, error: parsed.error };
        return;
      }
      const normalized = parsed.value;
      const consistent = normalized.type === "response.completed"
        ? isDeepStrictEqual(normalized.response, initial.value)
        : normalized.requestId === request.requestId;
      if (!consistent) {
        yield { type: "error", requestId: request.requestId, error: createElmoError("VALIDATION_ERROR", "Inconsistent scripted stream event") };
        return;
      }
      yield normalized;
      if (normalized.type !== "text.delta") return;
    }
    const result = context.signal?.aborted
      ? { ok: false as const, error: cancelledError() }
      : initial;
    if (result.ok) yield { type: "response.completed", response: result.value };
    else yield { type: "error", requestId: request.requestId, error: result.error };
  }
}
