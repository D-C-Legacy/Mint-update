export interface ChannelSendOutcome {
  readonly status: 'SENT' | 'FAILED';
  readonly providerMessageId: string | null;
  readonly failureReason: string | null;
}

export const PUSH_CHANNEL = Symbol('PushChannelPort');

export interface SendPushInput {
  readonly recipient: string; // the device's push token
  readonly title: string;
  readonly body: string;
}

// No real adapter exists yet — "Expo push or FCM" (07-IMPLEMENTATION-PLAN.md's P8-02 deliverable)
// is still an open, undecided choice; unlike every other integration point in this build,
// 02-TRD.md's stack table doesn't name a push SDK at all. P8-02 owns picking and building the
// real adapter against this exact port. No `Result` wrapping, same precedent as every other
// external-provider port in this codebase (StreamProviderPort, PaymentProviderPort,
// TransferProviderPort) — a failed send is ordinary data (`ChannelSendOutcome.status = 'FAILED'`,
// e.g. an invalidated token), a provider-level fault (network, auth) should throw.
export interface PushChannelPort {
  send(input: SendPushInput): Promise<ChannelSendOutcome>;
}

export const EMAIL_CHANNEL = Symbol('EmailChannelPort');

export interface SendEmailInput {
  readonly recipient: string; // email address
  readonly subject: string;
  readonly body: string;
}

// Same reasoning as PushChannelPort above — no real email SDK is named in any doc either
// (02-TRD.md's stack table has no email entry). P8-03 owns the real adapter.
export interface EmailChannelPort {
  send(input: SendEmailInput): Promise<ChannelSendOutcome>;
}
