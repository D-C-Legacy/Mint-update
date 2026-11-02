import { Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient, type VideoGrant } from 'livekit-server-sdk';
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

function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http');
}

@Injectable()
export class LiveKitStreamProviderAdapter implements StreamProviderPort {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly roomService: RoomServiceClient;

  constructor() {
    const { url, apiKey, apiSecret } = streamConfig.livekit;
    if (!url || !apiKey || !apiSecret) {
      throw new Error(
        'LiveKit config missing — STREAM_PROVIDER=livekit requires LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET',
      );
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.roomService = new RoomServiceClient(toHttpUrl(url), apiKey, apiSecret);
  }

  async createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
    const name = `session_${input.sessionId}`;
    await this.roomService.createRoom({ name });
    return { providerRoomId: name };
  }

  async publishToken(input: PublishTokenInput): Promise<PublisherAccess> {
    const token = await this.mintToken(input, {
      room: input.providerRoomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    return { mode: 'webrtc-token', token };
  }

  async viewerToken(input: ViewerTokenInput): Promise<ViewerAccess> {
    const token = await this.mintToken(input, {
      room: input.providerRoomId,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });
    return { mode: 'webrtc-token', token };
  }

  async endRoom(providerRoomId: string): Promise<void> {
    await this.roomService.deleteRoom(providerRoomId);
  }

  async roomExists(providerRoomId: string): Promise<boolean> {
    const rooms = await this.roomService.listRooms([providerRoomId]);
    return rooms.length > 0;
  }

  private async mintToken(
    input: { readonly userId: string; readonly displayName: string },
    grant: VideoGrant,
  ): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.userId,
      name: input.displayName,
    });
    token.addGrant(grant);
    return token.toJwt();
  }
}
