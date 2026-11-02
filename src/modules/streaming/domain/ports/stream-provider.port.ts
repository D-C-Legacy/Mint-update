export const STREAM_PROVIDER = Symbol('StreamProviderPort');

export interface CreateRoomInput {
  readonly sessionId: string;
}

export interface CreateRoomResult {
  readonly providerRoomId: string;
}

export interface PublishTokenInput {
  readonly providerRoomId: string;
  readonly userId: string;
  readonly displayName: string;
}

export interface ViewerTokenInput {
  readonly providerRoomId: string;
  readonly userId: string;
  readonly displayName: string;
}

// Providers deliver publish/view access in genuinely different shapes — LiveKit is a WebRTC room
// you join with a signed token; IVS is an RTMP ingest endpoint + stream key to broadcast to, and a
// plain HLS URL to watch. `mode` tells the caller (controller/view layer) which fields are
// populated, rather than forcing one provider's model onto the other (D-005, resolved to IVS,
// 14 Oct 2026 — this type was reshaped at that point; it used to be a bare `Promise<string>` JWT,
// which only ever fit LiveKit).
export type PublisherAccess =
  | { readonly mode: 'webrtc-token'; readonly token: string }
  | { readonly mode: 'rtmp'; readonly ingestEndpoint: string; readonly streamKey: string };

export type ViewerAccess =
  | { readonly mode: 'webrtc-token'; readonly token: string }
  | { readonly mode: 'hls'; readonly playbackUrl: string };

export interface StreamProviderPort {
  createRoom(input: CreateRoomInput): Promise<CreateRoomResult>;
  publishToken(input: PublishTokenInput): Promise<PublisherAccess>;
  viewerToken(input: ViewerTokenInput): Promise<ViewerAccess>;
  endRoom(providerRoomId: string): Promise<void>;
  /** Added in P4-03 for `stream.reconcile` (06-REALTIME-AND-CONCURRENCY.md §11: "polls provider
   * state every minute for sessions marked LIVE") — P4-02 only specified the original four
   * methods; this one was needed to actually implement that documented job. */
  roomExists(providerRoomId: string): Promise<boolean>;
}
