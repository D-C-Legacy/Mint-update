import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import { CursorPage } from '../../../shared/pagination/cursor';
import {
  CreateSessionUseCase,
  CreateSessionCommand,
  CreateSessionResult,
} from './commands/create-session.usecase';
import {
  StartSessionUseCase,
  StartSessionCommand,
  StartSessionResult,
} from './commands/start-session.usecase';
import {
  EndSessionUseCase,
  EndSessionCommand,
  EndSessionResult,
} from './commands/end-session.usecase';
import { KillSessionUseCase, KillSessionCommand } from './commands/kill-session.usecase';
import {
  ReceiveProviderWebhookUseCase,
  ReceiveProviderWebhookCommand,
  ReceiveProviderWebhookResult,
} from './commands/receive-provider-webhook.usecase';
import {
  GetSessionForJoinQuery,
  GetSessionForJoinCommand,
} from './queries/get-session-for-join.query';
import {
  GetViewerAccessQuery,
  GetViewerAccessCommand,
  GetViewerAccessResult,
} from './queries/get-viewer-access.query';
import {
  ListLiveSessionsQuery,
  ListLiveSessionsCommand,
  StreamSessionWithViewers,
} from './queries/list-live-sessions.query';
import { GetSessionDetailQuery, GetSessionDetailCommand } from './queries/get-session-detail.query';
import {
  GetSellerViewersSummaryQuery,
  GetSellerViewersSummaryCommand,
  SellerViewersSummary,
} from './queries/get-seller-viewers-summary.query';
import { PresenceService, PresenceUpdateResult } from '../infra/presence.service';
import {
  ChannelNotFoundError,
  InvalidStreamStatusError,
  NoPendingQueueItemsError,
  QueueItemNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
  StreamNotLiveError,
  StreamSessionNotFoundError,
  StreamModeratorNotFoundError,
  StreamModeratorAlreadyExistsError,
  CannotModerateSelfError,
  InsufficientStreamRoleError,
  UserAlreadyTimedOutError,
} from '../domain/errors/streaming.errors';
import { StreamSession } from '../domain/entities/stream-session.entity';
import { StreamQueueItem } from '../domain/entities/stream-queue-item.entity';
import { StreamModerator, ChatTimeout } from '../domain/entities/stream-moderation.entity';
import {
  AddQueueItemUseCase,
  AddQueueItemCommand,
  AddQueueItemResult,
} from './commands/add-queue-item.usecase';
import {
  ReorderQueueItemsUseCase,
  ReorderQueueItemsCommand,
  ReorderQueueItemsResult,
} from './commands/reorder-queue-items.usecase';
import {
  FeatureQueueItemUseCase,
  FeatureQueueItemCommand,
  FeatureQueueItemResult,
} from './commands/feature-queue-item.usecase';
import {
  SpinQueueWheelUseCase,
  SpinQueueWheelCommand,
  SpinQueueWheelResult,
} from './commands/spin-queue-wheel.usecase';
import {
  ToggleAutoQueueUseCase,
  ToggleAutoQueueCommand,
  ToggleAutoQueueResult,
} from './commands/toggle-auto-queue.usecase';
import {
  AddModeratorUseCase,
  AddModeratorCommand,
  AddModeratorResult,
} from './commands/add-moderator.usecase';
import {
  RemoveModeratorUseCase,
  RemoveModeratorCommand,
  RemoveModeratorResult,
} from './commands/remove-moderator.usecase';
import {
  TimeoutUserUseCase,
  TimeoutUserCommand,
  TimeoutUserResult,
} from './commands/timeout-user.usecase';
import { ListQueueItemsQuery, ListQueueItemsCommand } from './queries/list-queue-items.query';
import { ListModeratorsQueryImpl, ListModeratorsCommand } from './queries/list-moderators.query';
import { ListTimeoutsQueryImpl, ListTimeoutsCommand } from './queries/list-timeouts.query';

@Injectable()
export class StreamingService {
  constructor(
    private readonly createSessionUseCase: CreateSessionUseCase,
    private readonly startSessionUseCase: StartSessionUseCase,
    private readonly endSessionUseCase: EndSessionUseCase,
    private readonly killSessionUseCase: KillSessionUseCase,
    private readonly receiveProviderWebhookUseCase: ReceiveProviderWebhookUseCase,
    private readonly getSessionForJoinQuery: GetSessionForJoinQuery,
    private readonly getViewerAccessQuery: GetViewerAccessQuery,
    private readonly listLiveSessionsQuery: ListLiveSessionsQuery,
    private readonly getSessionDetailQuery: GetSessionDetailQuery,
    private readonly presence: PresenceService,
    private readonly addQueueItemUseCase: AddQueueItemUseCase,
    private readonly reorderQueueItemsUseCase: ReorderQueueItemsUseCase,
    private readonly featureQueueItemUseCase: FeatureQueueItemUseCase,
    private readonly spinQueueWheelUseCase: SpinQueueWheelUseCase,
    private readonly toggleAutoQueueUseCase: ToggleAutoQueueUseCase,
    private readonly addModeratorUseCase: AddModeratorUseCase,
    private readonly removeModeratorUseCase: RemoveModeratorUseCase,
    private readonly timeoutUserUseCase: TimeoutUserUseCase,
    private readonly listQueueItemsQuery: ListQueueItemsQuery,
    private readonly listModeratorsQuery: ListModeratorsQueryImpl,
    private readonly listTimeoutsQuery: ListTimeoutsQueryImpl,
    private readonly getSellerViewersSummaryQuery: GetSellerViewersSummaryQuery,
  ) {}

  async createSession(
    cmd: CreateSessionCommand,
  ): Promise<Result<CreateSessionResult, ChannelNotFoundError>> {
    return this.createSessionUseCase.execute(cmd);
  }

  async startSession(
    cmd: StartSessionCommand,
  ): Promise<
    Result<
      StartSessionResult,
      | StreamSessionNotFoundError
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ChannelNotFoundError
      | InvalidStreamStatusError
    >
  > {
    return this.startSessionUseCase.execute(cmd);
  }

  async endSession(
    cmd: EndSessionCommand,
  ): Promise<Result<EndSessionResult, StreamSessionNotFoundError | InvalidStreamStatusError>> {
    return this.endSessionUseCase.execute(cmd);
  }

  async killSession(
    cmd: KillSessionCommand,
  ): Promise<Result<StreamSession, StreamSessionNotFoundError | InvalidStreamStatusError>> {
    return this.killSessionUseCase.execute(cmd);
  }

  async receiveProviderWebhook(
    cmd: ReceiveProviderWebhookCommand,
  ): Promise<ReceiveProviderWebhookResult> {
    return this.receiveProviderWebhookUseCase.execute(cmd);
  }

  async getSessionForJoin(
    cmd: GetSessionForJoinCommand,
  ): Promise<Result<StreamSession, StreamSessionNotFoundError | StreamNotLiveError>> {
    return this.getSessionForJoinQuery.execute(cmd);
  }

  async getViewerAccess(
    cmd: GetViewerAccessCommand,
  ): Promise<Result<GetViewerAccessResult, StreamSessionNotFoundError | StreamNotLiveError>> {
    return this.getViewerAccessQuery.execute(cmd);
  }

  async listLiveSessions(
    cmd: ListLiveSessionsCommand,
  ): Promise<CursorPage<StreamSessionWithViewers>> {
    return this.listLiveSessionsQuery.execute(cmd);
  }

  async getSessionDetail(
    cmd: GetSessionDetailCommand,
  ): Promise<Result<StreamSessionWithViewers, StreamSessionNotFoundError>> {
    return this.getSessionDetailQuery.execute(cmd);
  }

  async recordHeartbeat(sessionId: string, userId: string): Promise<PresenceUpdateResult> {
    return this.presence.recordHeartbeat(sessionId, userId);
  }

  async removeViewer(sessionId: string, userId: string): Promise<PresenceUpdateResult> {
    return this.presence.removeViewer(sessionId, userId);
  }

  async addQueueItem(
    cmd: AddQueueItemCommand,
  ): Promise<Result<AddQueueItemResult, StreamSessionNotFoundError>> {
    return this.addQueueItemUseCase.execute(cmd);
  }

  async reorderQueueItems(
    cmd: ReorderQueueItemsCommand,
  ): Promise<Result<ReorderQueueItemsResult, StreamSessionNotFoundError | QueueItemNotFoundError>> {
    return this.reorderQueueItemsUseCase.execute(cmd);
  }

  async featureQueueItem(
    cmd: FeatureQueueItemCommand,
  ): Promise<Result<FeatureQueueItemResult, StreamSessionNotFoundError | QueueItemNotFoundError>> {
    return this.featureQueueItemUseCase.execute(cmd);
  }

  async listQueueItems(cmd: ListQueueItemsCommand): Promise<StreamQueueItem[]> {
    return this.listQueueItemsQuery.execute(cmd);
  }

  async spinQueueWheel(
    cmd: SpinQueueWheelCommand,
  ): Promise<Result<SpinQueueWheelResult, StreamSessionNotFoundError | NoPendingQueueItemsError>> {
    return this.spinQueueWheelUseCase.execute(cmd);
  }

  async getActiveQueueItem(sessionId: string): Promise<StreamQueueItem | null> {
    return this.listQueueItemsQuery.active(sessionId);
  }

  async toggleAutoQueue(
    cmd: ToggleAutoQueueCommand,
  ): Promise<Result<ToggleAutoQueueResult, StreamSessionNotFoundError>> {
    return this.toggleAutoQueueUseCase.execute(cmd);
  }

  // Stream moderation (Phase B)
  async addModerator(
    cmd: AddModeratorCommand,
  ): Promise<
    Result<
      AddModeratorResult,
      | StreamSessionNotFoundError
      | StreamModeratorAlreadyExistsError
      | CannotModerateSelfError
      | InsufficientStreamRoleError
    >
  > {
    return this.addModeratorUseCase.execute(cmd);
  }

  async removeModerator(
    cmd: RemoveModeratorCommand,
  ): Promise<
    Result<
      RemoveModeratorResult,
      StreamSessionNotFoundError | StreamModeratorNotFoundError | InsufficientStreamRoleError
    >
  > {
    return this.removeModeratorUseCase.execute(cmd);
  }

  async timeoutUser(
    cmd: TimeoutUserCommand,
  ): Promise<
    Result<
      TimeoutUserResult,
      | StreamSessionNotFoundError
      | StreamModeratorNotFoundError
      | UserAlreadyTimedOutError
      | InsufficientStreamRoleError
    >
  > {
    return this.timeoutUserUseCase.execute(cmd);
  }

  async listModerators(cmd: ListModeratorsCommand): Promise<CursorPage<StreamModerator>> {
    return this.listModeratorsQuery.execute(cmd);
  }

  async listTimeouts(cmd: ListTimeoutsCommand): Promise<CursorPage<ChatTimeout>> {
    return this.listTimeoutsQuery.execute(cmd);
  }

  async isUserTimedOut(sessionId: string, userId: string): Promise<ChatTimeout | null> {
    return this.listTimeoutsQuery
      .execute({ sessionId, userId, activeOnly: true, cursor: undefined, limit: 1 })
      .then((page) => page.items[0] ?? null);
  }

  async getSellerViewersSummary(
    cmd: GetSellerViewersSummaryCommand,
  ): Promise<SellerViewersSummary> {
    return this.getSellerViewersSummaryQuery.execute(cmd);
  }
}
