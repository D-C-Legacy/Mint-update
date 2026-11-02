import { Injectable } from '@nestjs/common';
import {
  IvsClient,
  CreateChannelCommand,
  GetChannelCommand,
  DeleteChannelCommand,
  GetStreamCommand,
  ListStreamKeysCommand,
  GetStreamKeyCommand,
  ChannelNotBroadcasting,
} from '@aws-sdk/client-ivs';
import { streamConfig } from '../../../config/stream.config';
import {
  CreateRoomInput,
  CreateRoomResult,
  PublisherAccess,
  PublishTokenInput,
  StreamProviderPort,
  ViewerAccess,
  ViewerTokenInput,
} from '../domain/ports/stream-provider.port';

// Classic IVS (Channels: RTMP in, HLS out), not IVS Real-Time (Stages: WebRTC, per-participant
// billing) — chosen because the actual shape here is one broadcaster watched by many viewers, not
// a handful of interactive participants (D-005, 09-DECISIONS.md, resolved 14 Oct 2026).
@Injectable()
export class IvsStreamProviderAdapter implements StreamProviderPort {
  private readonly client: IvsClient;

  constructor() {
    const { region, accessKeyId, secretAccessKey } = streamConfig.ivs;
    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'IVS config missing — STREAM_PROVIDER=ivs requires IVS_REGION/IVS_ACCESS_KEY_ID/IVS_SECRET_ACCESS_KEY',
      );
    }
    this.client = new IvsClient({ region, credentials: { accessKeyId, secretAccessKey } });
  }

  async createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
    const result = await this.client.send(
      new CreateChannelCommand({
        name: `session_${input.sessionId}`,
        latencyMode: 'LOW',
        type: 'STANDARD',
      }),
    );
    const arn = result.channel?.arn;
    if (!arn) {
      throw new Error('IVS CreateChannel did not return a channel ARN');
    }
    return { providerRoomId: arn };
  }

  // Re-fetches rather than caching what createRoom already returned (the CreateChannel response
  // includes both the ingest endpoint and the stream key) — keeps this method self-contained and
  // callable independently of createRoom, same as every other port method, at the cost of two
  // extra IVS API calls on a "go live" click. Not a hot path, not worth the added state.
  async publishToken(input: PublishTokenInput): Promise<PublisherAccess> {
    const channel = await this.client.send(new GetChannelCommand({ arn: input.providerRoomId }));
    const ingestEndpoint = channel.channel?.ingestEndpoint;
    if (!ingestEndpoint) {
      throw new Error(`IVS channel ${input.providerRoomId} has no ingest endpoint`);
    }

    const keys = await this.client.send(
      new ListStreamKeysCommand({ channelArn: input.providerRoomId }),
    );
    const keyArn = keys.streamKeys?.[0]?.arn;
    if (!keyArn) {
      throw new Error(`IVS channel ${input.providerRoomId} has no stream key`);
    }

    const key = await this.client.send(new GetStreamKeyCommand({ arn: keyArn }));
    const value = key.streamKey?.value;
    if (!value) {
      throw new Error(`IVS stream key ${keyArn} has no value`);
    }

    // AWS returns `ingestEndpoint` as a bare hostname (e.g. "x1x2x3x4.global-contribute.live-video.net"),
    // not a usable RTMP(S) URL — pasting that directly into OBS's "Server" field fails with "Invalid
    // Path or Connection URL" (confirmed live, founder-reported 15 Oct 2026). IVS requires RTMPS on
    // 443 at the /app path: https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast-rtmp.html
    return { mode: 'rtmp', ingestEndpoint: `rtmps://${ingestEndpoint}:443/app/`, streamKey: value };
  }

  // Public HLS playback needs no per-viewer credential for a non-private channel — `mode: 'hls'`
  // just carries the channel's stable playback URL. Authorized/private channels (a future need, not
  // today's) would populate a signed playback token here instead.
  async viewerToken(input: ViewerTokenInput): Promise<ViewerAccess> {
    const channel = await this.client.send(new GetChannelCommand({ arn: input.providerRoomId }));
    const playbackUrl = channel.channel?.playbackUrl;
    if (!playbackUrl) {
      throw new Error(`IVS channel ${input.providerRoomId} has no playback URL`);
    }
    return { mode: 'hls', playbackUrl };
  }

  async endRoom(providerRoomId: string): Promise<void> {
    await this.client.send(new DeleteChannelCommand({ arn: providerRoomId }));
  }

  // GetStream (not GetChannel) deliberately — the channel resource persists whether or not it's
  // broadcasting; stream.reconcile needs "is this session still actually live right now", which is
  // exactly what GetStream answers (throws ChannelNotBroadcasting when nothing is being pushed to
  // the channel).
  async roomExists(providerRoomId: string): Promise<boolean> {
    try {
      await this.client.send(new GetStreamCommand({ channelArn: providerRoomId }));
      return true;
    } catch (err) {
      if (err instanceof ChannelNotBroadcasting) {
        return false;
      }
      throw err;
    }
  }
}
