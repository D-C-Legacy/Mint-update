import { SellersService } from '../../sellers/application/sellers.service';
import { Result, Ok, Err } from '../../../shared/result/result';
import { BidBySellerError } from '../domain/errors/sales.errors';

// Sale.sellerId stores the Seller entity's own id (matching catalog's Product.sellerId
// precedent — confirmed via create-product.usecase.ts resolving a Seller.id, not a User.id),
// but the acting party on a bid/buy/offer is identified by their User.id. These are different
// id spaces that never incidentally collide, so a direct `actingUserId === sale.sellerId`
// comparison (as AuctionEntity.evaluateBid originally did through P5-04/P5-06) can never
// actually catch a seller acting on their own sale — found live in P5-08's verification.
// Resolves the acting user's OWN seller profile (if they have one at all) and compares its id
// against the sale's sellerId instead. A buyer with no seller profile can never be the seller,
// so `getMySeller` failing is the common, expected non-match case, not an error to propagate.
export async function guardNotSeller(
  sellers: SellersService,
  actingUserId: string,
  saleId: string,
  saleSellerId: string,
): Promise<Result<void, BidBySellerError>> {
  const myProfile = await sellers.getMySeller({ userId: actingUserId });
  if (myProfile.ok && myProfile.value.seller.id === saleSellerId) {
    return Err(new BidBySellerError(saleId));
  }
  return Ok(undefined);
}
