import { test } from "node:test";
import assert from "node:assert/strict";
import { auctionReducer, initialAuction } from "../src/auction.ts";
test("full bid, competitor, countdown and win flow", () => {
  let a = auctionReducer(initialAuction, { type: "bid", amount: 1500 });
  assert.equal(a.state, "leading");
  a = auctionReducer(a, { type: "competitor" });
  assert.equal(a.current, 1650);
  assert.equal(a.minimum, 1700);
  assert.equal(a.state, "outbid");
  a = auctionReducer(a, { type: "bid", amount: 1700 });
  a = auctionReducer(a, { type: "countdown" });
  for (let i = 0; i < 8; i++) a = auctionReducer(a, { type: "tick" });
  assert.equal(a.state, "won");
  assert.equal(a.seconds, 0);
});
test("invalid and closed auction bids never succeed", () => {
  assert.equal(
    auctionReducer(initialAuction, { type: "bid", amount: 1400 }),
    initialAuction,
  );
  const ended = { ...initialAuction, state: "ended" as const };
  assert.equal(auctionReducer(ended, { type: "bid", amount: 2000 }), ended);
});
test("outbid user loses at the countdown", () => {
  let a = auctionReducer(initialAuction, { type: "bid", amount: 1500 });
  a = auctionReducer(a, { type: "competitor" });
  a = auctionReducer(a, { type: "countdown" });
  for (let i = 0; i < 8; i++) a = auctionReducer(a, { type: "tick" });
  assert.equal(a.state, "lost");
  assert.equal(auctionReducer(a, { type: "reset" }).state, "live");
});
test("non-finite bids cannot corrupt the auction", () => {
  for (const amount of [NaN, Infinity, -Infinity])
    assert.equal(
      auctionReducer(initialAuction, { type: "bid", amount }),
      initialAuction,
    );
});
