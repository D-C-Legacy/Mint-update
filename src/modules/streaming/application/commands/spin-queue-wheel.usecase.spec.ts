import { describe, expect, it } from 'vitest';
import { SpinQueueWheelUseCase } from './spin-queue-wheel.usecase';
import type { ChannelsService } from '../../../channels/application/channels.service';
import type { StreamSessionRepositoryPort } from '../../domain/ports/stream-session.repository.port';
import type {
  CreateQueueItemInput,
  StreamQueueItemRepositoryPort,
} from '../../domain/ports/stream-queue-item.repository.port';
import type { StreamSession } from '../../domain/entities/stream-session.entity';
import type { StreamQueueItem } from '../../domain/entities/stream-queue-item.entity';
import type { EventBusPort } from '../../../../shared/events/event-bus.port';
import { Ok } from '../../../../shared/result/result';
import {
  NoPendingQueueItemsError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';
import { QUEUE_WHEEL_SPUN_EVENT } from '../../events/published/queue-wheel-spun.event';

const SESSION_ID = 'sess_1';
const CHANNEL_ID = 'chan_1';
const SELLER_USER_ID = 'user_seller';

function session(): StreamSession {
  return {
    id: SESSION_ID,
    channelId: CHANNEL_ID,
    title: 'Test stream',
    status: 'LIVE',
    providerRoomId: null,
    scheduledFor: null,
    startedAt: new Date(),
    endedAt: null,
    peakViewers: 0,
    itemsSold: 0,
    grossAmount: 0n,
    thumbnailKey: null,
    autoQueueEnabled: false,
    createdAt: new Date(),
  };
}

function queueItem(overrides: Partial<StreamQueueItem> = {}): StreamQueueItem {
  return {
    id: 'item_1',
    sessionId: SESSION_ID,
    productId: 'prod_1',
    position: 0,
    mode: 'AUCTION',
    startAmount: null,
    price: null,
    quantity: null,
    status: 'PENDING',
    saleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Fake port implementations, same hand-rolled style as event-bus.service.spec.ts's FakePubSub —
// no mocking library used anywhere else in this codebase for port doubles.
class FakeChannelsService {
  getMyChannel(): ReturnType<ChannelsService['getMyChannel']> {
    return Promise.resolve(
      Ok({
        channel: {
          id: CHANNEL_ID,
          sellerId: 'seller_1',
          slug: 'test',
          name: 'Test',
          bio: null,
          bannerKey: null,
          followerCount: 0,
          isActive: true,
          createdAt: new Date(),
        },
      }),
    );
  }
}

class FakeSessionRepository implements Pick<StreamSessionRepositoryPort, 'findById'> {
  findById(id: string): Promise<StreamSession | null> {
    return Promise.resolve(id === SESSION_ID ? session() : null);
  }
}

// Records every write-method call so a test can assert none happened — the use case is meant to
// be read + broadcast only, never writing to the queue.
class FakeQueueItemRepository implements StreamQueueItemRepositoryPort {
  writeCalls: string[] = [];
  constructor(private readonly items: StreamQueueItem[]) {}

  findById(id: string): Promise<StreamQueueItem | null> {
    return Promise.resolve(this.items.find((i) => i.id === id) ?? null);
  }
  listBySession(): Promise<StreamQueueItem[]> {
    return Promise.resolve(this.items);
  }
  findActiveBySession(): Promise<StreamQueueItem | null> {
    return Promise.resolve(this.items.find((i) => i.status === 'ACTIVE') ?? null);
  }
  create(input: CreateQueueItemInput): Promise<StreamQueueItem> {
    this.writeCalls.push('create');
    return Promise.resolve(queueItem({ id: input.id }));
  }
  reorder(): Promise<void> {
    this.writeCalls.push('reorder');
    return Promise.resolve();
  }
  markActive(id: string): Promise<StreamQueueItem> {
    this.writeCalls.push('markActive');
    return Promise.resolve(queueItem({ id, status: 'ACTIVE' }));
  }
  markDone(id: string): Promise<StreamQueueItem> {
    this.writeCalls.push('markDone');
    return Promise.resolve(queueItem({ id, status: 'DONE' }));
  }
}

class FakeEventBus implements Pick<EventBusPort, 'publish'> {
  published: { name: string; payload: unknown }[] = [];
  publish<TPayload>(event: { name: string; payload: TPayload }): Promise<void> {
    this.published.push({ name: event.name, payload: event.payload });
    return Promise.resolve();
  }
}

function setup(items: StreamQueueItem[]): {
  usecase: SpinQueueWheelUseCase;
  queueItems: FakeQueueItemRepository;
  eventBus: FakeEventBus;
} {
  const sessions = new FakeSessionRepository();
  const queueItems = new FakeQueueItemRepository(items);
  const eventBus = new FakeEventBus();
  const usecase = new SpinQueueWheelUseCase(
    new FakeChannelsService() as unknown as ChannelsService,
    sessions as unknown as StreamSessionRepositoryPort,
    queueItems,
    eventBus as unknown as EventBusPort,
  );
  return { usecase, queueItems, eventBus };
}

describe('SpinQueueWheelUseCase', () => {
  it('fails with NoPendingQueueItemsError when the queue has nothing PENDING', async () => {
    const { usecase } = setup([queueItem({ id: 'a', status: 'DONE' })]);

    const result = await usecase.execute({ userId: SELLER_USER_ID, sessionId: SESSION_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoPendingQueueItemsError);
  });

  it('fails with StreamSessionNotFoundError for an unknown session', async () => {
    const { usecase } = setup([queueItem()]);

    const result = await usecase.execute({ userId: SELLER_USER_ID, sessionId: 'nope' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(StreamSessionNotFoundError);
  });

  it('always picks one of the PENDING items and broadcasts it, writing nothing', async () => {
    const pendingIds = ['a', 'b', 'c'];
    const items = [
      ...pendingIds.map((id) => queueItem({ id, status: 'PENDING' })),
      queueItem({ id: 'done', status: 'DONE' }),
    ];
    const { usecase, queueItems, eventBus } = setup(items);

    for (let i = 0; i < 20; i++) {
      const result = await usecase.execute({ userId: SELLER_USER_ID, sessionId: SESSION_ID });
      expect(result.ok).toBe(true);
      if (result.ok) expect(pendingIds).toContain(result.value.item.id);
    }

    expect(eventBus.published).toHaveLength(20);
    expect(eventBus.published.every((e) => e.name === QUEUE_WHEEL_SPUN_EVENT)).toBe(true);
    expect(queueItems.writeCalls).toHaveLength(0);
  });
});
