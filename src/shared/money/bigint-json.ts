// Side-effecting import, same shape as `import 'reflect-metadata'` — must run before anything
// in the process serializes a response or a socket emit. Without this, `JSON.stringify` throws
// `TypeError: Do not know how to serialize a BigInt` the instant any response carries a raw
// money field (`Sale.startAmount`, `Bid.amount`, etc.) — found live while building P5-09, the
// first ticket whose HTTP/WS responses actually return bigint fields directly rather than
// through a domain event (which already serializes manually, see bid-accepted.event.ts).
//
// `Number`, not `.toString()`: 05-API-SPEC.md §1 — "All money returned as integer minor
// units" — the documented response contract is a plain JSON integer, not a string.
export {};

declare global {
  interface BigInt {
    toJSON(): number;
  }
}

BigInt.prototype.toJSON = function (this: bigint): number {
  return Number(this);
};
