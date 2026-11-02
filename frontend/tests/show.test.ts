import { test } from "node:test";
import assert from "node:assert/strict";
import { validateShowStep } from "../src/utils/show.ts";
const valid = {
  duration: "30",
  increment: "50",
  shipping: "12",
  date: "2026-10-02",
  time: "19:00",
};
test("show rules reject invalid amounts and impossible dates", () => {
  assert.equal(validateShowStep(2, valid), null);
  assert.ok(validateShowStep(2, { ...valid, duration: "0" }));
  assert.ok(validateShowStep(2, { ...valid, increment: "NaN" }));
  assert.ok(validateShowStep(3, { ...valid, shipping: "-1" }));
  assert.ok(validateShowStep(4, { ...valid, date: "2026-02-31" }));
  assert.ok(validateShowStep(4, { ...valid, time: "25:00" }));
  assert.equal(validateShowStep(4, valid), null);
});
