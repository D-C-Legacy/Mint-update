import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreatePaymentInput,
  PaymentRepositoryPort,
  UpdatePaymentOutcomeInput,
} from '../../domain/ports/payment.repository.port';
import { Payment } from '../../domain/entities/payment.entity';
import { toDomainPayment } from '../mappers/payment.mapper';

@Injectable()
export class PaymentPrismaRepository implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { id } });
    return row ? toDomainPayment(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { orderId } });
    return row ? toDomainPayment(row) : null;
  }

  async findByProviderIntentId(providerIntentId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { providerIntentId } });
    return row ? toDomainPayment(row) : null;
  }

  // `providerChargeId` is not unique in the schema (a payment has at most one charge, but the
  // column is plain nullable text), so the first match is used.
  async findByProviderChargeId(providerChargeId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findFirst({ where: { providerChargeId } });
    return row ? toDomainPayment(row) : null;
  }

  // `Payment.orderId` is @unique — a genuine concurrent race (two PAY calls on the same order)
  // means the loser's insert hits P2002. Disambiguated here, not left to throw: the loser gets
  // handed the WINNING row instead, same "fetch-and-return-existing" shape as P3-04's slug
  // collision handling and P2-05's seller-creation redelivery race.
  async create(input: CreatePaymentInput): Promise<Payment> {
    try {
      const row = await this.prisma.payment.create({
        data: {
          id: input.id,
          orderId: input.orderId,
          providerIntentId: input.providerIntentId,
          amount: input.amount,
          currency: input.currency,
        },
      });
      return toDomainPayment(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.payment.findUniqueOrThrow({ where: { orderId: input.orderId } });
        return toDomainPayment(existing);
      }
      throw err;
    }
  }

  async updateOutcome(id: string, input: UpdatePaymentOutcomeInput): Promise<Payment> {
    const row = await this.prisma.payment.update({
      where: { id },
      data: {
        status: input.status,
        providerChargeId: input.providerChargeId,
        providerFee: input.providerFee,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        capturedAt: input.capturedAt,
      },
    });
    return toDomainPayment(row);
  }

  async markRefundStatus(id: string, status: 'REFUNDED' | 'PARTIALLY_REFUNDED'): Promise<Payment> {
    const row = await this.prisma.payment.update({ where: { id }, data: { status } });
    return toDomainPayment(row);
  }
}
