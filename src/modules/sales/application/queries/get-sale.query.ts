import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { Sale } from '../../domain/entities/sale.entity';
import { SaleNotFoundError } from '../../domain/errors/sales.errors';

export interface GetSaleCommand {
  readonly saleId: string;
}

@Injectable()
export class GetSaleQuery {
  constructor(@Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort) {}

  async execute(cmd: GetSaleCommand): Promise<Result<Sale, SaleNotFoundError>> {
    const sale = await this.sales.findById(cmd.saleId);
    if (!sale) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }
    return Ok(sale);
  }
}
