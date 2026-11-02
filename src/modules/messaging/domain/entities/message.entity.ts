export interface Message {
  readonly id: string;
  readonly conversationId: string;
  readonly senderUserId: string;
  readonly body: string;
  readonly createdAt: Date;
}
