export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export type DeliveryConfirmationSource = 'CARRIER' | 'BUYER' | 'AUTO' | 'ADMIN';

export interface Order {
  readonly id: string;
  readonly saleId: string;
  readonly buyerUserId: string;
  readonly sellerId: string;
  readonly status: OrderStatus;
  readonly currency: string;

  readonly itemAmount: bigint;
  readonly shippingAmount: bigint;
  readonly taxAmount: bigint;
  readonly totalAmount: bigint;
  readonly commissionBps: number;
  readonly commissionAmount: bigint;
  readonly sellerNetAmount: bigint;

  readonly shippingAddress: Record<string, unknown>;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly deliveryConfirmedBy: DeliveryConfirmationSource | null;
  readonly cancelledAt: Date | null;
  readonly cancelReason: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}
