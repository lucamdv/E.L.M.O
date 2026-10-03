import { EventEnvelopeSchema, type EventEnvelope, type InboxPort } from "../../../src/elmo/contracts/events";
import { validateContract, type ContractResult } from "../../../src/elmo/contracts/errors";

/** Receive-only test sink. Assertion access is not part of the production InboxPort. */
export class InboxPortFake implements InboxPort {
  private readonly events: EventEnvelope[] = [];

  get received(): EventEnvelope[] {
    return structuredClone(this.events);
  }

  async receive(event: EventEnvelope): Promise<ContractResult<void>> {
    const validated = validateContract(EventEnvelopeSchema, event);
    if (!validated.ok) return validated;
    this.events.push(validated.value);
    return { ok: true, value: undefined };
  }
}
