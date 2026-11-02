export type StreamStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface StreamSession {
  readonly id: string;
  readonly channelId: string;
  readonly title: string;
  readonly status: StreamStatus;
  readonly providerRoomId: string | null;
  readonly scheduledFor: Date | null;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly peakViewers: number;
  readonly itemsSold: number;
  readonly grossAmount: bigint;
  readonly thumbnailKey: string | null;
  // Per-show toggle for the automatic feature-product queue (round5 §5, 26 Oct 2026) — resets to
  // false on every new session, never persisted as a seller-level default.
  readonly autoQueueEnabled: boolean;
  readonly createdAt: Date;
}
