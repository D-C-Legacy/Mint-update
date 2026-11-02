export interface IncrementBand {
  readonly minAmount: bigint; // minor units, inclusive lower bound
  readonly incrementAmount: bigint; // minor units
}

export function minimumNextBid(currentAmount: bigint, bands: readonly IncrementBand[]): bigint {
  return currentAmount + incrementAmountFor(currentAmount, bands);
}

function incrementAmountFor(amount: bigint, bands: readonly IncrementBand[]): bigint {
  let applicable: IncrementBand | undefined;

  for (const band of bands) {
    if (amount >= band.minAmount && (applicable === undefined || band.minAmount > applicable.minAmount)) {
      applicable = band;
    }
  }

  if (applicable === undefined) {
    throw new Error('No increment band covers this amount — bands must include one starting at 0');
  }

  return applicable.incrementAmount;
}
