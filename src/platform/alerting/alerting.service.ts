import { Injectable } from '@nestjs/common';
import { LockService } from '../redis/lock.service';
import { LoggerService } from '../logger/logger.service';
import { alertingConfig } from '../../config/alerting.config';
import { NotificationsService } from '../../modules/notifications/application/notifications.service';

// 02-TRD.md §7's "Alerts" bullet names four conditions; 07-IMPLEMENTATION-PLAN.md's P9-04 row adds
// a fifth (bid latency p95). Delivery channel is a user decision this session: email via the
// already-integrated Resend adapter (`NotificationsService.sendRawEmail`, added for this) — no
// doc names a channel at all, same gap-class as the push/email PROVIDER choices in P8-02/P8-03,
// resolved the same way (asked directly rather than guessed).
@Injectable()
export class AlertingService {
  constructor(
    private readonly lock: LockService,
    private readonly logger: LoggerService,
    private readonly notifications: NotificationsService,
  ) {}

  // `dedupeKey` identifies the *condition* (e.g. `queue-depth:sales`), not the individual event —
  // a Redis NX lock with a TTL of `alertingConfig.cooldownMinutes` means a persisting breach is
  // reported once per cooldown window, not once per sweep tick (every `sweepIntervalMs`, by
  // default far more often than anyone should be paged for the same ongoing incident). Same
  // Redis-NX-lock-as-throttle technique as `PresenceService`'s `viewers.count` broadcast throttle
  // (P4-05) — the mechanism this codebase already reaches for whenever "at most once per window,
  // across however many process instances are racing to notice" is the requirement.
  async sendCriticalAlert(dedupeKey: string, subject: string, body: string): Promise<void> {
    const lockKey = `alert:cooldown:${dedupeKey}`;
    const acquired = await this.lock.acquire(lockKey, alertingConfig.cooldownMinutes * 60_000);
    if (!acquired) {
      return;
    }

    this.logger.error(`CRITICAL ALERT: ${subject} — ${body}`);

    if (!alertingConfig.emailTo) {
      return;
    }
    const outcome = await this.notifications.sendRawEmail(alertingConfig.emailTo, `[ALERT] ${subject}`, body);
    if (outcome.status === 'FAILED') {
      this.logger.error(`Alert email failed to send for "${subject}": ${outcome.failureReason}`);
    }
  }
}
