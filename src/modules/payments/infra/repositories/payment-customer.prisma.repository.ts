import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { PaymentCustomerRepositoryPort } from '../../domain/ports/payment-customer.repository.port';

@Injectable()
export class PaymentCustomerPrismaRepository implements PaymentCustomerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findProviderCustomerId(userId: string): Promise<string | null> {
    const row = await this.prisma.paymentCustomer.findUnique({ where: { userId } });
    return row ? row.providerCustomerId : null;
  }

  async save(userId: string, providerCustomerId: string): Promise<string> {
    try {
      const row = await this.prisma.paymentCustomer.create({ data: { userId, providerCustomerId } });
      return row.providerCustomerId;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.paymentCustomer.findUniqueOrThrow({ where: { userId } });
        return existing.providerCustomerId;
      }
      throw err;
    }
  }
}
