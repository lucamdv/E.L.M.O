import { EventEnvelopeSchema, type EventBus, type EventEnvelope, type EventHandler } from "../contracts/events";
import { toElmoError, validateContract, type ContractResult } from "../contracts/errors";

/** Instance-local, sequential delivery; the first handler failure ends this publish. */
export class LocalEventBus implements EventBus {
  private readonly subscriptions = new Map<string, Set<EventHandler>>();

  subscribe(type: string, handler: EventHandler): () => void {
    const handlers = this.subscriptions.get(type) ?? new Set<EventHandler>();
    const subscription: EventHandler = (event) => handler(event);
    handlers.add(subscription);
    this.subscriptions.set(type, handlers);
    return () => {
      if (!handlers.delete(subscription)) return;
      if (handlers.size === 0) this.subscriptions.delete(type);
    };
  }

  async publish(event: EventEnvelope): Promise<ContractResult<void>> {
    const validated = validateContract(EventEnvelopeSchema, event);
    if (!validated.ok) return validated;
    try {
      for (const handler of this.subscriptions.get(validated.value.type) ?? []) await handler(validated.value);
    } catch (error) {
      return { ok: false, error: toElmoError(error) };
    }
    return { ok: true, value: undefined };
  }
}
