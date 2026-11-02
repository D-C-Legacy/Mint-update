export type ChatMessageType = 'USER' | 'SYSTEM' | 'BID_ANNOUNCE' | 'SALE_ANNOUNCE';

export interface ChatMessage {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly body: string;
  readonly type: ChatMessageType;
  readonly isDeleted: boolean;
  readonly deletedByUserId: string | null;
  readonly createdAt: Date;
}
