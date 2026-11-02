import { describe, expect, it } from 'vitest';
import { EventBusService } from './event-bus.service';
import type { PubSubService } from '../redis/pubsub.service';
import { createDomainEvent } from '../../shared/events/domain-event';

// A stand-in for Redis pub/sub: records what was announced and lets a test deliver a message as if
// another process had published it.
class FakePubSub {
  readonly published: { channel: string; message: string }[] = [];
  readonly subscribed = new Map<string, (message: string) => void>();

  publish(channel: string, message: string): Promise<void> {
    this.published.push({ channel, message });
    return Promise.resolve();
  }

  subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    this.subscribed.set(channel, handler);
    return Promise.resolve();
  }

  deliverFromAnotherProcess(channel: string, name: string, payload: unknown): void {
    const wire = {
      name,
      version: 1,
      occurredAt: new Date().toISOString(),
      payload,
      instanceId: 'some-other-process',
    };
    this.subscribed.get(channel)?.(JSON.stringify(wire));
  }
}

function setup(): { pubsub: FakePubSub; bus: EventBusService } {
  const pubsub = new FakePubSub();
  const bus = new EventBusService(pubsub as unknown as PubSubService);
  return { pubsub, bus };
}

describe('EventBusService', () => {
  it('runs a handler registered in the same process when an event is published', async () => {
    const { bus } = setup();
    const seen: unknown[] = [];
    bus.subscribe('thing.happened', (e) => void seen.push(e.payload));

    await bus.publish(createDomainEvent('thing.happened', 1, { n: 1 }));

    expect(seen).toEqual([{ n: 1 }]);
  });

  it('announces every published event on Redis, even with no handler here', async () => {
    const { bus, pubsub } = setup();

    await bus.publish(createDomainEvent('thing.happened', 1, { n: 1 }));

    expect(pubsub.published.map((p) => p.channel)).toEqual(['events:thing.happened']);
  });

  it('does not run an ordinary handler for an event another process published', () => {
    const { bus, pubsub } = setup();
    const seen: unknown[] = [];
    bus.subscribe('thing.happened', (e) => void seen.push(e.payload));

    pubsub.deliverFromAnotherProcess('events:thing.happened', 'thing.happened', { n: 2 });

    // Otherwise a notification or ledger handler would run once per process (api, realtime, worker).
    expect(seen).toEqual([]);
    expect(pubsub.subscribed.size).toBe(0);
  });

  it('runs a cross-process handler for an event another process published', () => {
    const { bus, pubsub } = setup();
    const seen: unknown[] = [];
    bus.subscribe('thing.happened', (e) => void seen.push(e.payload), { crossProcess: true });

    pubsub.deliverFromAnotherProcess('events:thing.happened', 'thing.happened', { n: 3 });

    expect(seen).toEqual([{ n: 3 }]);
  });

  it('does not run a cross-process handler twice for its own process echo', async () => {
    const { bus, pubsub } = setup();
    const seen: unknown[] = [];
    bus.subscribe('thing.happened', (e) => void seen.push(e.payload), { crossProcess: true });

    await bus.publish(createDomainEvent('thing.happened', 1, { n: 4 }));
    // Redis echoes the message back to the publisher: it carries this process's own instance id.
    const echoed = pubsub.published[0];
    if (echoed === undefined) {
      throw new Error('the publish should have recorded an announcement before the echo');
    }
    pubsub.subscribed.get('events:thing.happened')?.(echoed.message);

    expect(seen).toEqual([{ n: 4 }]);
  });

  it('keeps ordinary handlers local even when another handler for the same event is cross-process', () => {
    const { bus, pubsub } = setup();
    const ordinary: unknown[] = [];
    const remote: unknown[] = [];
    bus.subscribe('thing.happened', (e) => void ordinary.push(e.payload));
    bus.subscribe('thing.happened', (e) => void remote.push(e.payload), { crossProcess: true });

    pubsub.deliverFromAnotherProcess('events:thing.happened', 'thing.happened', { n: 5 });

    expect(remote).toEqual([{ n: 5 }]);
    expect(ordinary).toEqual([]);
  });
});
