import { Injectable } from '@nestjs/common';
import { generateId } from '../../shared/ids/id';
import { DomainEvent } from '../../shared/events/domain-event';
import { DomainEventHandler, EventBusPort, SubscribeOptions } from '../../shared/events/event-bus.port';
import { PubSubService } from '../redis/pubsub.service';

const CHANNEL_PREFIX = 'events:';

// Tags every published event with this process's instance id so that when Redis echoes it back to
// this same process's own subscription, it can be skipped — local handlers already ran it directly.
interface WireEvent<TPayload> extends DomainEvent<TPayload> {
  readonly instanceId: string;
}

// Delivery model: `publish` runs every handler registered in THIS process, then announces the event
// on Redis. Other processes only act on it for handlers that registered with `crossProcess: true`
// (see SubscribeOptions for why that is opt-in). Events are always announced on Redis, so a
// cross-process subscriber elsewhere never misses one.
@Injectable()
export class EventBusService implements EventBusPort {
  private readonly instanceId = generateId();
  private readonly handlers = new Map<string, Set<DomainEventHandler<unknown>>>();
  // Handlers that also want events published by other processes.
  private readonly remoteHandlers = new Map<string, Set<DomainEventHandler<unknown>>>();

  constructor(private readonly pubsub: PubSubService) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const local = this.handlers.get(event.name);
    if (local) {
      await Promise.all([...local].map((handler) => Promise.resolve(handler(event))));
    }

    const wire: WireEvent<TPayload> = { ...event, instanceId: this.instanceId };
    await this.pubsub.publish(CHANNEL_PREFIX + event.name, JSON.stringify(wire));
  }

  subscribe<TPayload>(name: string, handler: DomainEventHandler<TPayload>, options?: SubscribeOptions): void {
    // Stored untyped because handlers for different event names share one map; each subscriber's
    // own generic type was already checked at this call site.
    const untyped = handler as unknown as DomainEventHandler<unknown>;

    let local = this.handlers.get(name);
    if (!local) {
      local = new Set();
      this.handlers.set(name, local);
    }
    local.add(untyped);

    if (options?.crossProcess) {
      this.addRemoteHandler(name, untyped);
    }
  }

  private addRemoteHandler(name: string, handler: DomainEventHandler<unknown>): void {
    let remote = this.remoteHandlers.get(name);
    if (!remote) {
      const set = new Set<DomainEventHandler<unknown>>();
      remote = set;
      this.remoteHandlers.set(name, set);
      void this.pubsub.subscribe(CHANNEL_PREFIX + name, (message) => {
        const wire = JSON.parse(message) as WireEvent<unknown>;
        if (wire.instanceId === this.instanceId) return;

        const event: DomainEvent<unknown> = {
          name: wire.name,
          version: wire.version,
          occurredAt: new Date(wire.occurredAt),
          payload: wire.payload,
        };
        set.forEach((h) => {
          void h(event);
        });
      });
    }
    remote.add(handler);
  }
}
