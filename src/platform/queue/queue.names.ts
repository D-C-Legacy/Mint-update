export const QueueNames = {
  SALES: 'sales',
  STREAMING: 'streaming',
  CHAT: 'chat',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  LEDGER: 'ledger',
  PAYOUTS: 'payouts',
  NOTIFICATIONS: 'notifications',
  ALERTING: 'alerting',
  IDENTITY: 'identity',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];
