import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const STREAM_STARTED_EVENT = 'stream.started';
export const STREAM_STARTED_VERSION = 1;

// Added for P8-04 ("channel went live" is one of the 6 deliverables) — nothing in this module
// published any event before this; StartSessionUseCase is the only natural "went live" moment.
export interface StreamStartedPayload {
  readonly sessionId: string;
  readonly channelId: string;
  readonly sellerId: string;
  readonly title: string;
}

export function streamStartedEvent(payload: StreamStartedPayload): DomainEvent<StreamStartedPayload> {
  return createDomainEvent(STREAM_STARTED_EVENT, STREAM_STARTED_VERSION, payload);
}
