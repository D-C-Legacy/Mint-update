import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySaleCancelled,
  applySaleExtended,
  applySaleResolved,
  applySaleUpdated,
  offerResponseMessage,
  outbidMessage,
} from "../src/realtime/sale-events.ts";
import type { SaleDetail } from "../src/api/sales.ts";

const sale: SaleDetail = {
  id: "sale_1",
  sessionId: "ses_1",
  sellerId: "sel_1",
  productId: "prod_1",
  mode: "AUCTION",
  status: "OPEN",
  currency: "USD",
  startAmount: 1000,
  currentAmount: 1500,
  currentBidId: "bid_1",
  endsAt: "2026-10-12T10:00:00.000Z",
  price: null,
  quantity: 1,
  winnerUserId: null,
  finalAmount: null,
  resolvedAt: null,
  createdAt: "2026-10-12T09:00:00.000Z",
};

test("sale.updated moves the price and end time", () => {
  const next = applySaleUpdated(sale, { saleId: "sale_1", currentAmount: 1800, endsAt: "2026-10-12T10:00:10.000Z", bidCount: 4 });
  assert.equal(next.currentAmount, 1800);
  assert.equal(next.endsAt, "2026-10-12T10:00:10.000Z");
});

test("sale.updated for another sale, a malformed payload or an older price changes nothing", () => {
  assert.equal(applySaleUpdated(sale, { saleId: "other", currentAmount: 2000, endsAt: "x" }), sale);
  assert.equal(applySaleUpdated(sale, { saleId: "sale_1", currentAmount: "2000" }), sale);
  assert.equal(applySaleUpdated(sale, null), sale);
  assert.equal(applySaleUpdated(sale, { saleId: "sale_1", currentAmount: 1200, endsAt: "2026-10-12T10:00:00.000Z" }), sale);
});

test("sale.updated never reopens a sale that already ended", () => {
  const ended = { ...sale, status: "RESOLVED" as const };
  assert.equal(applySaleUpdated(ended, { saleId: "sale_1", currentAmount: 9000, endsAt: "x" }), ended);
});

test("sale.extended moves only the end time", () => {
  const next = applySaleExtended(sale, { saleId: "sale_1", endsAt: "2026-10-12T10:00:20.000Z", extensionCount: 2 });
  assert.equal(next.endsAt, "2026-10-12T10:00:20.000Z");
  assert.equal(next.currentAmount, 1500);
  assert.equal(applySaleExtended(sale, { saleId: "sale_1" }), sale);
});

test("sale.resolved closes the sale with the winner and final amount", () => {
  const next = applySaleResolved(sale, { saleId: "sale_1", winnerUserId: "usr_9", finalAmount: 2500 });
  assert.equal(next.status, "RESOLVED");
  assert.equal(next.winnerUserId, "usr_9");
  assert.equal(next.finalAmount, 2500);
  assert.equal(applySaleResolved(sale, { saleId: "other", winnerUserId: "u", finalAmount: 1 }), sale);
});

test("sale.cancelled closes an open sale but never undoes a resolved one", () => {
  assert.equal(applySaleCancelled(sale, { saleId: "sale_1", reason: "seller" }).status, "CANCELLED");
  const resolved = { ...sale, status: "RESOLVED" as const };
  assert.equal(applySaleCancelled(resolved, { saleId: "sale_1", reason: "seller" }), resolved);
});

test("outbid text shows the new amount in dollars and ignores other sales", () => {
  assert.equal(outbidMessage("sale_1", { saleId: "sale_1", newAmount: 2050 }), "You were outbid. The current bid is $20.50.");
  assert.equal(outbidMessage("sale_1", { saleId: "sale_2", newAmount: 2050 }), null);
  assert.equal(outbidMessage("sale_1", { saleId: "sale_1" }), "You were outbid.");
});

test("offer responses are matched to the tracked offer only", () => {
  assert.equal(offerResponseMessage("off_1", { offerId: "off_1", status: "ACCEPTED", counterAmount: null }), "The seller accepted your offer.");
  assert.equal(offerResponseMessage("off_1", { offerId: "off_1", status: "REJECTED", counterAmount: null }), "The seller declined your offer.");
  assert.equal(offerResponseMessage("off_1", { offerId: "off_1", status: "COUNTERED", counterAmount: 4000 }), "The seller countered with $40.00.");
  assert.equal(offerResponseMessage("off_1", { offerId: "off_2", status: "ACCEPTED", counterAmount: null }), null);
  assert.equal(offerResponseMessage(null, { offerId: "off_1", status: "ACCEPTED" }), null);
});
