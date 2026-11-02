import { test } from "node:test";
import assert from "node:assert/strict";
import { validEmail, validateSignUp } from "../src/utils/auth.ts";
test("sign up accepts a valid demo profile and rejects invalid fields", () => {
  const valid = {
    name: "Alex Morgan",
    email: "alex@example.com",
    password: "demopass123",
    confirmPassword: "demopass123",
  };
  assert.deepEqual(validateSignUp(valid), {});
  const errors = validateSignUp({
    ...valid,
    name: "",
    email: "alex@",
    password: "abc",
    confirmPassword: "different",
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "confirmPassword",
    "email",
    "name",
    "password",
  ]);
});
test("email validation rejects incomplete domains and spaces", () => {
  for (const value of [
    "alex@",
    "alex@example",
    "a b@example.com",
    "@example.com",
  ])
    assert.equal(validEmail(value), false);
  assert.equal(validEmail(" alex@example.com "), true);
});
