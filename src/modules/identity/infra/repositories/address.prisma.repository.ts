import { Injectable } from '@nestjs/common';
import type { UserAddress } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { AddressRepositoryPort, CreateAddressInput } from '../../domain/ports/address.repository.port';
import { Address, AddressPatch } from '../../domain/entities/address.entity';

function toDomain(row: UserAddress): Address {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
  };
}

// Only the keys the patch carries; a missing key leaves its column untouched.
function toColumns(patch: AddressPatch): Partial<Omit<UserAddress, 'id' | 'userId' | 'isDefault' | 'createdAt' | 'updatedAt'>> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
}

@Injectable()
export class AddressPrismaRepository implements AddressRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(userId: string): Promise<Address[]> {
    const rows = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.userAddress.count({ where: { userId } });
  }

  async create(input: CreateAddressInput): Promise<Address> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.userAddress.updateMany({ where: { userId: input.userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.userAddress.create({ data: { ...input } });
    });
    return toDomain(row);
  }

  async update(id: string, userId: string, patch: AddressPatch, makeDefault: boolean): Promise<Address | null> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userAddress.findFirst({ where: { id, userId } });
      if (!existing) return null;
      if (makeDefault) {
        await tx.userAddress.updateMany({ where: { userId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.userAddress.update({
        where: { id },
        data: { ...toColumns(patch), ...(makeDefault ? { isDefault: true } : {}) },
      });
    });
    return row ? toDomain(row) : null;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userAddress.findFirst({ where: { id, userId } });
      if (!existing) return false;
      await tx.userAddress.delete({ where: { id } });
      if (existing.isDefault) {
        const next = await tx.userAddress.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (next) await tx.userAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      return true;
    });
  }
}
