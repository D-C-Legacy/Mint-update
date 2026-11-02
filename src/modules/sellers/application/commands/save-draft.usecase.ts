import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { InvalidSellerStatusError } from '../../domain/errors/sellers.errors';
import { SellerStatus, SellerType } from '../../domain/entities/seller.entity';

export interface SaveDraftCommand {
  readonly userId: string;
  readonly type: SellerType;
  readonly legalName: string;
  readonly displayName: string;
  readonly formData: Record<string, unknown>;
}

export interface SaveDraftResult {
  readonly sellerId: string;
  readonly applicationId: string;
  readonly status: SellerStatus;
}

@Injectable()
export class SaveDraftUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(cmd: SaveDraftCommand): Promise<Result<SaveDraftResult, InvalidSellerStatusError>> {
    const existing = await this.sellers.findByUserId(cmd.userId);

    if (!existing) {
      const seller = await this.sellers.createDraft({
        id: generateId(),
        userId: cmd.userId,
        type: cmd.type,
        legalName: cmd.legalName,
        displayName: cmd.displayName,
        applicationId: generateId(),
        formData: cmd.formData,
      });
      return Ok({ sellerId: seller.id, applicationId: seller.application.id, status: seller.status });
    }

    if (existing.status !== 'DRAFT') {
      return Err(new InvalidSellerStatusError('update the application', 'DRAFT', existing.status));
    }

    const seller = await this.sellers.updateDraft(existing.id, {
      type: cmd.type,
      legalName: cmd.legalName,
      displayName: cmd.displayName,
      formData: cmd.formData,
    });
    return Ok({ sellerId: seller.id, applicationId: seller.application.id, status: seller.status });
  }
}
