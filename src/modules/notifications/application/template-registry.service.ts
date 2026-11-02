import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../domain/entities/notification-delivery.entity';
import { NotificationTemplate } from '../domain/entities/notification-template.entity';

// No real template content is registered here — "channel went live, outbid, won, order
// shipped, payout sent, application decided" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable)
// is the ticket that actually knows what copy each event needs and registers it. This is only
// the lookup mechanism: register once per (key, channel) pair, resolve by the same pair.
@Injectable()
export class TemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  register(template: NotificationTemplate): void {
    const cacheKey = this.cacheKey(template.key, template.channel);
    if (this.templates.has(cacheKey)) {
      throw new Error(`A template is already registered for ${template.key}/${template.channel}`);
    }
    this.templates.set(cacheKey, template);
  }

  resolve(templateKey: string, channel: NotificationChannel): NotificationTemplate | undefined {
    return this.templates.get(this.cacheKey(templateKey, channel));
  }

  private cacheKey(templateKey: string, channel: NotificationChannel): string {
    return `${templateKey}:${channel}`;
  }
}
