import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../shared/ids/id';
import { Result, Ok, Err } from '../../../shared/result/result';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../shared/pagination/cursor';
import { EVENT_BUS, EventBusPort } from '../../../shared/events/event-bus.port';
import { TemplateRegistry } from './template-registry.service';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepositoryPort,
} from '../domain/ports/notification.repository.port';
import {
  ChannelSendOutcome,
  EMAIL_CHANNEL,
  EmailChannelPort,
  PUSH_CHANNEL,
  PushChannelPort,
} from '../domain/ports/notification-channel.port';
import {
  NotificationChannel,
  NotificationDelivery,
} from '../domain/entities/notification-delivery.entity';
import {
  RenderedContent,
  RenderedEmailContent,
  RenderedPushContent,
} from '../domain/entities/notification-template.entity';
import { NotificationNotFoundError } from '../domain/errors/notifications.errors';
import { notificationCreatedEvent } from '../events/published/notification-created.event';

export interface ListMyNotificationsCommand {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface MarkNotificationReadCommand {
  readonly id: string;
  readonly userId: string;
}

export interface MarkAllNotificationsReadCommand {
  readonly userId: string;
}

export interface DeleteNotificationCommand {
  readonly id: string;
  readonly userId: string;
}

export interface NotifyCommand {
  readonly userId: string;
  readonly templateKey: string;
  readonly channel: NotificationChannel;
  // The push token or email address to send to. Resolving "which user → which address" (a
  // cross-module read into modules/identity's Device/User tables) is deliberately left to the
  // caller — same precedent as StreamProviderPort/PaymentProviderPort taking an explicit
  // providerRoomId/providerCustomerId rather than resolving one internally. P8-04's event
  // handlers are expected to do that resolution before calling notify().
  readonly recipient: string;
  readonly data: Record<string, unknown>;
}

// 07-IMPLEMENTATION-PLAN.md's P8-01 deliverable: "template registry, channel ports, delivery
// record." This is the one orchestrating method that ties all three together — resolve the
// template, render it, record the delivery attempt, send it, record the outcome. P8-02/P8-03
// only ever need to bind a real PushChannelPort/EmailChannelPort implementation; this method's
// shape doesn't change when they land.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly templates: TemplateRegistry,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepositoryPort,
    @Inject(PUSH_CHANNEL) private readonly pushChannel: PushChannelPort,
    @Inject(EMAIL_CHANNEL) private readonly emailChannel: EmailChannelPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async notify(cmd: NotifyCommand): Promise<NotificationDelivery> {
    const template = this.templates.resolve(cmd.templateKey, cmd.channel);
    if (!template) {
      // A missing template registration is a deployment/config bug — every real caller knows
      // its own templateKey ahead of time — not a user-reachable condition, matching the
      // "throw only for genuinely unexpected conditions" precedent (increment.rule.ts's
      // misconfigured-band throw, place-bid.usecase.ts's non-AUCTION-sale throw).
      throw new Error(`No template registered for ${cmd.templateKey}/${cmd.channel}`);
    }

    const rendered = template.render(cmd.data);
    const content = rendered as unknown as Record<string, unknown>;
    const delivery = await this.notifications.createDelivery({
      id: generateId(),
      userId: cmd.userId,
      channel: cmd.channel,
      templateKey: cmd.templateKey,
      recipient: cmd.recipient,
      content,
    });

    // Only the EMAIL delivery (one per user per notify() call, unlike PUSH which fans out per
    // device) stands in for "a new notification" for the inbox/badge — see
    // notification-created.event.ts and NotificationRepositoryPort.listForUser.
    if (cmd.channel === 'EMAIL') {
      await this.eventBus.publish(
        notificationCreatedEvent({
          id: delivery.id,
          userId: cmd.userId,
          templateKey: cmd.templateKey,
          content,
          createdAt: delivery.createdAt.toISOString(),
          ref: (cmd.data.ref as { type: string; id: string }) ?? undefined,
        }),
      );
    }

    const outcome = await this.sendViaChannel(cmd.channel, cmd.recipient, rendered);

    return this.notifications.updateDeliveryOutcome(delivery.id, {
      status: outcome.status,
      providerMessageId: outcome.providerMessageId,
      failureReason: outcome.failureReason,
      sentAt: outcome.status === 'SENT' ? new Date() : null,
    });
  }

  // P9-04's alerting needs a plain email send with no template, no `userId`, and no
  // `NotificationDelivery` row (an ops alert isn't a user-facing notification — forcing it
  // through `notify()` would mean inventing a fake `userId` and templateKey for data that
  // doesn't fit that schema). Thin pass-through to the already-bound `EMAIL_CHANNEL`, same
  // "small facade addition a later ticket's own job genuinely needs" precedent as
  // `GetMyChannelQuery`/`GetSellerByIdQuery`.
  async sendRawEmail(
    recipient: string,
    subject: string,
    body: string,
  ): Promise<ChannelSendOutcome> {
    return this.emailChannel.send({ recipient, subject, body });
  }

  // GET /v1/me/notifications — not in 05-API-SPEC.md, added for the Phase 6 inbox.
  async listMine(
    cmd: ListMyNotificationsCommand,
  ): Promise<{ page: CursorPage<NotificationDelivery>; unreadCount: number }> {
    const limit = normalizeLimit(cmd.limit);
    const [rows, unreadCount] = await Promise.all([
      this.notifications.listForUser({ userId: cmd.userId, cursor: cmd.cursor, limit }),
      this.notifications.countUnreadForUser(cmd.userId),
    ]);
    return { page: buildCursorPage(rows, limit), unreadCount };
  }

  // POST /v1/me/notifications/:id/read — not in 05-API-SPEC.md, added for the Phase 6 inbox.
  async markRead(
    cmd: MarkNotificationReadCommand,
  ): Promise<Result<NotificationDelivery, NotificationNotFoundError>> {
    const updated = await this.notifications.markRead(cmd.id, cmd.userId);
    if (!updated) {
      return Err(new NotificationNotFoundError(cmd.id));
    }
    return Ok(updated);
  }

  // POST /v1/me/notifications/read-all — not in 05-API-SPEC.md, added for the Phase 4 Activity
  // screen's mark-all-read button (user-directed, same precedent as the Phase 6 read-one route).
  async markAllRead(cmd: MarkAllNotificationsReadCommand): Promise<number> {
    return this.notifications.markAllRead(cmd.userId);
  }

  // DELETE /v1/me/notifications/:id — not in 05-API-SPEC.md, added for the Phase 4 Activity
  // screen (soft delete via NotificationDelivery.deletedAt; the user picked that over hard
  // deletion so the send record survives as the audit row).
  async deleteNotification(
    cmd: DeleteNotificationCommand,
  ): Promise<Result<void, NotificationNotFoundError>> {
    const deleted = await this.notifications.deleteNotification(cmd.id, cmd.userId);
    if (!deleted) {
      return Err(new NotificationNotFoundError(cmd.id));
    }
    return Ok(undefined);
  }

  private async sendViaChannel(
    channel: NotificationChannel,
    recipient: string,
    rendered: RenderedContent,
  ): Promise<ChannelSendOutcome> {
    if (channel === 'PUSH') {
      const content = rendered as RenderedPushContent;
      return this.pushChannel.send({ recipient, title: content.title, body: content.body });
    }
    const content = rendered as RenderedEmailContent;
    return this.emailChannel.send({ recipient, subject: content.subject, body: content.body });
  }
}
