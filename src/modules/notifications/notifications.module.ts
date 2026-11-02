import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { IdentityModule } from '../identity/identity.module';
import { ChannelsModule } from '../channels/channels.module';
import { SellersModule } from '../sellers/sellers.module';
import { NOTIFICATION_REPOSITORY } from './domain/ports/notification.repository.port';
import { PUSH_CHANNEL, EMAIL_CHANNEL } from './domain/ports/notification-channel.port';
import { NotificationPrismaRepository } from './infra/repositories/notification.prisma.repository';
import { ExpoPushChannelAdapter } from './infra/push-channel.expo.adapter';
import { ResendEmailChannelAdapter } from './infra/email-channel.resend.adapter';
import { TemplateRegistry } from './application/template-registry.service';
import { NotificationsService } from './application/notifications.service';
import { NotificationsController } from './api/http/notifications.controller';
import { NotificationsGateway } from './api/ws/notifications.gateway';
import { UserNotificationDispatcher } from './events/handlers/user-notification-dispatcher.service';
import { OnBidAcceptedHandler } from './events/handlers/on-bid-accepted.handler';
import { OnSaleResolvedHandler } from './events/handlers/on-sale-resolved.handler';
import { OnStreamStartedHandler } from './events/handlers/on-stream-started.handler';
import { OnOrderShippedHandler } from './events/handlers/on-order-shipped.handler';
import { OnPayoutSentHandler } from './events/handlers/on-payout-sent.handler';
import { OnSellerDecidedHandler } from './events/handlers/on-seller-decided.handler';
import { OnPasswordChangedHandler } from './events/handlers/on-password-changed.handler';
import { OnEmailChangeRequestedHandler } from './events/handlers/on-email-change-requested.handler';
import { OnAccountDeletionRequestedHandler } from './events/handlers/on-account-deletion-requested.handler';
import { OnAccountDeletionCancelledHandler } from './events/handlers/on-account-deletion-cancelled.handler';
import { OnAccountDeletionReminderDueHandler } from './events/handlers/on-account-deletion-reminder-due.handler';
import { OnAccountDeletionCompletedHandler } from './events/handlers/on-account-deletion-completed.handler';

// P8-04 is what finally wires this module in (both at the DI level and into app.module.ts) —
// P8-02/P8-03 built the real PUSH_CHANNEL/EMAIL_CHANNEL adapters but deliberately left them
// unbound (flagged in PROGRESS.md: their Touches columns never reached this file). This ticket's
// own 6 event handlers are the first real callers of NotificationsService.notify(), so this is
// the natural point to close that gap — same "wire it in when something actually needs it live
// at boot" reasoning as P3-04's ChannelsModule/SellerApprovedHandler.
@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    AuthModule,
    RateLimitModule,
    IdentityModule,
    ChannelsModule,
    // forwardRef: breaks the Sellers ↔ Notifications ↔ Channels module cycle (see sellers.module.ts).
    forwardRef(() => SellersModule),
  ],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationPrismaRepository },
    { provide: PUSH_CHANNEL, useClass: ExpoPushChannelAdapter },
    { provide: EMAIL_CHANNEL, useClass: ResendEmailChannelAdapter },
    TemplateRegistry,
    NotificationsService,
    NotificationsGateway,
    UserNotificationDispatcher,
    OnBidAcceptedHandler,
    OnSaleResolvedHandler,
    OnStreamStartedHandler,
    OnOrderShippedHandler,
    OnPayoutSentHandler,
    OnSellerDecidedHandler,
    OnPasswordChangedHandler,
    OnEmailChangeRequestedHandler,
    OnAccountDeletionRequestedHandler,
    OnAccountDeletionCancelledHandler,
    OnAccountDeletionReminderDueHandler,
    OnAccountDeletionCompletedHandler,
  ],
  exports: [TemplateRegistry, NotificationsService],
})
export class NotificationsModule {}
