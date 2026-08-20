import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeRateLimit, getClientIp } from "./rateLimit";

test("consumeRateLimit allows traffic under the limit and blocks after", () => {
  const key = `test-${Date.now()}`;
  const nowMs = 1_000_000;

  assert.equal(consumeRateLimit({ key, limit: 2, nowMs }), true);
  assert.equal(consumeRateLimit({ key, limit: 2, nowMs: nowMs + 1 }), true);
  assert.equal(consumeRateLimit({ key, limit: 2, nowMs: nowMs + 2 }), false);
});

test("consumeRateLimit expires timestamps outside the window", () => {
  const key = `test-window-${Date.now()}`;
  const nowMs = 2_000_000;

  assert.equal(consumeRateLimit({ key, limit: 1, nowMs }), true);
  assert.equal(consumeRateLimit({ key, limit: 1, nowMs: nowMs + 60_001 }), true);
});

test("getClientIp prefers the first forwarded hop", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "203.0.113.10, 10.0.0.1",
      socketAddress: "127.0.0.1",
    }),
    "203.0.113.10",
  );
});
