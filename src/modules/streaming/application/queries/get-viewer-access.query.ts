import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  STREAM_PROVIDER,
  StreamProviderPort,
  ViewerAccess,
} from '../../domain/ports/stream-provider.port';
import {
  StreamNotLiveError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';
import { GetSessionForJoinQuery } from './get-session-for-join.query';

export interface GetViewerAccessCommand {
  readonly sessionId: string;
  readonly userId: string;
  // Only meaningful for a WebRTC provider (LiveKit embeds it as the room participant's name) — IVS
  // viewer access is a plain playback URL with no per-viewer identity at all, so this is optional
  // rather than requiring every caller to look up a display name it may never use.
  readonly displayName?: string;
}

export interface GetViewerAccessResult {
  readonly providerRoomId: string;
  readonly viewerAccess: ViewerAccess;
}

// POST /streams/:id/viewer-token (05-API-SPEC.md §6) — reuses GetSessionForJoinQuery's LIVE check
// rather than duplicating it; the only thing this adds is actually minting the provider-side
// viewer credential, which nothing called before this (D-005 was unresolved, so there was no real
// video to issue a viewer credential for).
@Injectable()
export class GetViewerAccessQuery {
  constructor(
    private readonly getSessionForJoin: GetSessionForJoinQuery,
    @Inject(STREAM_PROVIDER) private readonly provider: StreamProviderPort,
  ) {}

  async execute(
    cmd: GetViewerAccessCommand,
  ): Promise<Result<GetViewerAccessResult, StreamSessionNotFoundError | StreamNotLiveError>> {
    const sessionResult = await this.getSessionForJoin.execute({ sessionId: cmd.sessionId });
    if (!sessionResult.ok) {
      return Err(sessionResult.error);
    }

    const session = sessionResult.value;
    if (!session.providerRoomId) {
      // LIVE sessions always have a providerRoomId (set in StartSessionUseCase) — this branch is
      // unreachable in practice, but the field is nullable on the entity, so TypeScript needs it
      // handled rather than asserted away.
      return Err(new StreamNotLiveError(cmd.sessionId));
    }

    const viewerAccess = await this.provider.viewerToken({
      providerRoomId: session.providerRoomId,
      userId: cmd.userId,
      displayName: cmd.displayName ?? '',
    });

    return Ok({ providerRoomId: session.providerRoomId, viewerAccess });
  }
}
