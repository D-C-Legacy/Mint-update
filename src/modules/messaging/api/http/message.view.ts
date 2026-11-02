import { Message } from '../../domain/entities/message.entity';

export function toMessageView(message: Message, viewerUserId: string): Record<string, unknown> {
  return {
    id: message.id,
    conversationId: message.conversationId,
    body: message.body,
    mine: message.senderUserId === viewerUserId,
    createdAt: message.createdAt.toISOString(),
  };
}
