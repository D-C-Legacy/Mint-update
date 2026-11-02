import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateDocumentInput,
  SellerDocumentRepositoryPort,
} from '../../domain/ports/seller-document.repository.port';
import { SellerDocument } from '../../domain/entities/seller-document.entity';
import { toDomainSellerDocument } from '../mappers/seller-document.mapper';

@Injectable()
export class SellerDocumentPrismaRepository implements SellerDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDocumentInput): Promise<SellerDocument> {
    const row = await this.prisma.sellerDocument.create({
      data: {
        id: input.id,
        applicationId: input.applicationId,
        type: input.type,
        storageKey: input.storageKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    return toDomainSellerDocument(row);
  }

  async findById(id: string): Promise<SellerDocument | null> {
    const row = await this.prisma.sellerDocument.findUnique({ where: { id } });
    return row ? toDomainSellerDocument(row) : null;
  }

  async listForApplication(applicationId: string): Promise<SellerDocument[]> {
    const rows = await this.prisma.sellerDocument.findMany({
      where: { applicationId },
      orderBy: { uploadedAt: 'asc' },
    });
    return rows.map(toDomainSellerDocument);
  }

  async deleteForApplication(documentId: string, applicationId: string): Promise<boolean> {
    const result = await this.prisma.sellerDocument.deleteMany({
      where: { id: documentId, applicationId },
    });
    return result.count > 0;
  }
}
