import { NotificationChannel } from './notification-delivery.entity';

export interface RenderedPushContent {
  readonly title: string;
  readonly body: string;
}

export interface RenderedEmailContent {
  readonly subject: string;
  readonly body: string;
}

export type RenderedContent = RenderedPushContent | RenderedEmailContent;

// No real template content is defined here — which events need which copy is P8-04's own job
// ("event subscriptions"), not this ticket's to invent. This is only the shape a template must
// satisfy: a pure function from arbitrary event data to channel-appropriate rendered content.
export interface NotificationTemplate {
  readonly key: string;
  readonly channel: NotificationChannel;
  render(data: Record<string, unknown>): RenderedContent;
}
