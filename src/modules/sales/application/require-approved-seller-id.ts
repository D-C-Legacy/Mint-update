import { SellersService } from '../../sellers/application/sellers.service';
import { Result, Ok, Err } from '../../../shared/result/result';
import { SellerNotApprovedError, SellerProfileNotFoundError } from '../domain/errors/sales.errors';

// Mirrors catalog's own require-approved-seller.ts (same reasoning, same shared error codes):
// sales cannot import modules/sellers/domain/** or modules/catalog/application/** across the
// module boundary, only SellersService.
export async function requireApprovedSellerId(
  sellers: SellersService,
  userId: string,
): Promise<Result<string, SellerProfileNotFoundError | SellerNotApprovedError>> {
  const sellerResult = await sellers.getMySeller({ userId });
  if (!sellerResult.ok) {
    return Err(new SellerProfileNotFoundError(userId));
  }
  if (sellerResult.value.seller.status !== 'APPROVED') {
    return Err(new SellerNotApprovedError());
  }
  return Ok(sellerResult.value.seller.id);
}
