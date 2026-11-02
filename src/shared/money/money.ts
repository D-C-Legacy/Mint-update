export function add(a: bigint, b: bigint): bigint {
  return a + b;
}

export function subtract(a: bigint, b: bigint): bigint {
  return a - b;
}

export function percentage(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / 10_000n;
}
