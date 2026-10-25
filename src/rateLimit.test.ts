import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeRateLimit, getClientIp } from "./rateLimit";

void test("consumeRateLimit allows traffic under the limit and blocks after", () => {
  const key = `test-${Date.now()}`;
  const nowMs = 1_000_000;

  assert.equal(consumeRateLimit({ key, limit: 2, nowMs }), true);
  assert.equal(consumeRateLimit({ key, limit: 2, nowMs: nowMs + 1 }), true);
  assert.equal(consumeRateLimit({ key, limit: 2, nowMs: nowMs + 2 }), false);
});

void test("consumeRateLimit expires timestamps outside the window", () => {
  const key = `test-window-${Date.now()}`;
  const nowMs = 2_000_000;

  assert.equal(consumeRateLimit({ key, limit: 1, nowMs }), true);
  assert.equal(consumeRateLimit({ key, limit: 1, nowMs: nowMs + 60_001 }), true);
});

void test("consumeRateLimit evicts the least recently used bucket once the cap is reached", () => {
  const key = `test-evict-${Date.now()}`;
  const nowMs = 3_000_000;

  assert.equal(consumeRateLimit({ key, limit: 1, nowMs }), true);
  assert.equal(consumeRateLimit({ key, limit: 1, nowMs }), false);

  for (let index = 0; index < 50_000; index += 1) {
    consumeRateLimit({ key: `test-evict-filler-${index}`, limit: 1, nowMs });
  }

  assert.equal(consumeRateLimit({ key, limit: 1, nowMs }), true);
});

void test("getClientIp ignores client-supplied forwarded hops and uses the trusted proxy hop", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "198.51.100.7, 203.0.113.10",
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 1,
      trustCloudflareEdgeHop: false,
      host: undefined,
      cloudflareEdgeHost: null,
    }),
    "203.0.113.10",
  );
});

void test("getClientIp counts trusted hops across repeated forwarded headers", () => {
  assert.equal(
    getClientIp({
      forwardedFor: ["198.51.100.7", "203.0.113.10, 10.0.0.1"],
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 2,
      trustCloudflareEdgeHop: false,
      host: undefined,
      cloudflareEdgeHost: null,
    }),
    "203.0.113.10",
  );
});

void test("getClientIp uses the socket address when no proxy hop is trusted", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "198.51.100.7",
      socketAddress: "127.0.0.1",
      trustedProxyHopCount: 0,
      trustCloudflareEdgeHop: false,
      host: undefined,
      cloudflareEdgeHost: null,
    }),
    "127.0.0.1",
  );
});

void test("getClientIp uses the socket address when the header is shorter than the trusted chain", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "198.51.100.7",
      socketAddress: "127.0.0.1",
      trustedProxyHopCount: 2,
      trustCloudflareEdgeHop: false,
      host: undefined,
      cloudflareEdgeHost: null,
    }),
    "127.0.0.1",
  );
});

void test("getClientIp steps over a Cloudflare edge to the client our zone recorded", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "198.51.100.66, 203.0.113.10, 104.22.5.6",
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 1,
      trustCloudflareEdgeHop: true,
      host: "dev.mcp.videogen.io",
      cloudflareEdgeHost: "dev.mcp.videogen.io",
    }),
    "203.0.113.10",
  );

  assert.equal(
    getClientIp({
      forwardedFor: "2001:db8::1, 2606:4700::1",
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 1,
      trustCloudflareEdgeHop: true,
      host: "DEV.mcp.videogen.io:443",
      cloudflareEdgeHost: "dev.mcp.videogen.io",
    }),
    "2001:db8::1",
  );
});

void test("getClientIp keys a direct run.app caller on the Cloudflare peer, not a supplied hop", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "198.51.100.99, 104.22.5.6",
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 1,
      trustCloudflareEdgeHop: true,
      host: "mcp-dev-963680179378.us-central1.run.app",
      cloudflareEdgeHost: "dev.mcp.videogen.io",
    }),
    "104.22.5.6",
  );
});

void test("getClientIp keys a caller that skips Cloudflare on its own address", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "203.0.113.10, 104.22.5.6, 198.51.100.7",
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 1,
      trustCloudflareEdgeHop: true,
      host: "dev.mcp.videogen.io",
      cloudflareEdgeHost: "dev.mcp.videogen.io",
    }),
    "198.51.100.7",
  );
});

void test("getClientIp keeps a lone Cloudflare edge address when nothing precedes it", () => {
  assert.equal(
    getClientIp({
      forwardedFor: "104.22.5.6",
      socketAddress: "169.254.1.1",
      trustedProxyHopCount: 1,
      trustCloudflareEdgeHop: true,
      host: "dev.mcp.videogen.io",
      cloudflareEdgeHost: "dev.mcp.videogen.io",
    }),
    "104.22.5.6",
  );
});
