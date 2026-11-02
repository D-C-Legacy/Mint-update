export interface SellerBankAccount {
  readonly id: string;
  readonly sellerId: string;
  readonly accountHolder: string;
  readonly last4: string;
  readonly encryptedRef: string;
  readonly bankName: string | null;
  readonly country: string;
  readonly currency: string;
  readonly verifiedAt: Date | null;
}
