import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { PAYOUT_REPOSITORY, PayoutRepositoryPort } from '../../domain/ports/payout.repository.port';
import { InvalidPayoutStatusError, PayoutNotFoundError } from '../../domain/errors/payouts.errors';
import { Payout } from '../../domain/entities/payout.entity';

export interface HoldPayoutCommand {
  readonly payoutId: string;
}

// `POST /admin/payouts/:id/hold` (05-API-SPEC.md §11) — unowned by any ticket. Only PENDING
// payouts can be held (see InvalidPayoutStatusError's own doc comment for why); the un-hold path
// back to PENDING isn't documented anywhere and isn't built here.
@Injectable()
export class HoldPayoutUseCase {
  constructor(@Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepositoryPort) {}

  async execute(cmd: HoldPayoutCommand): Promise<Result<Payout, PayoutNotFoundError | InvalidPayoutStatusError>> {
    const existing = await this.payouts.findPayoutById(cmd.payoutId);
    if (!existing) {
      return Err(new PayoutNotFoundError(cmd.payoutId));
    }

    const held = await this.payouts.holdPayout(cmd.payoutId);
    if (!held) {
      return Err(new InvalidPayoutStatusError('hold the payout', 'PENDING', existing.status));
    }

    return Ok(held);
  }
}
