import { SellersService } from '../../sellers/application/sellers.service';
import { Result, Ok, Err } from '../../../shared/result/result';
import { SellerNotApprovedError, SellerProfileNotFoundError } from '../domain/errors/catalog.errors';

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
