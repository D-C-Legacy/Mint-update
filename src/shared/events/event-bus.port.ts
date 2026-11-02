import { DomainEvent } from './domain-event';

export const EVENT_BUS = Symbol('EventBusPort');

export type DomainEventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => Promise<void> | void;

export interface SubscribeOptions {
  // Also receive this event when it was published by ANOTHER process (through Redis).
  //
  // Default false: a handler runs in the process that published the event, once. Every process
  // (api, realtime, worker) registers every handler, so delivering each event to all of them would
  // run every side effect (notifications, ledger, orders) once per process. Only a subscriber that
  // must act in a specific process regardless of who published opts in: the Socket.IO gateways,
  // because the sockets live in the realtime process while bids and sales are published from the
  // API and worker processes.
  readonly crossProcess?: boolean;
}

export interface EventBusPort {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(name: string, handler: DomainEventHandler<TPayload>, options?: SubscribeOptions): void;
}
