import assert from "node:assert/strict";
import { test } from "node:test";
import { getCallsProtectedTool } from "./protectedToolAuth";

void test("getCallsProtectedTool is false for discovery and noauth tools", () => {
  assert.equal(getCallsProtectedTool({ method: "initialize" }), false);
  assert.equal(getCallsProtectedTool({ method: "tools/list" }), false);
  assert.equal(
    getCallsProtectedTool({
      method: "tools/call",
      params: { name: "open_uploader" },
    }),
    false,
  );
  assert.equal(
    getCallsProtectedTool({
      method: "tools/call",
      params: { name: "get_app_deep_link" },
    }),
    false,
  );
});

void test("getCallsProtectedTool is true for protected tools and unknown names", () => {
  assert.equal(
    getCallsProtectedTool({
      method: "tools/call",
      params: { name: "get_me" },
    }),
    true,
  );
  assert.equal(
    getCallsProtectedTool({
      method: "tools/call",
      params: {},
    }),
    true,
  );
  assert.equal(
    getCallsProtectedTool({
      method: "tools/call",
    }),
    true,
  );
});

void test("getCallsProtectedTool inspects JSON-RPC batches", () => {
  assert.equal(
    getCallsProtectedTool([
      { method: "tools/list" },
      { method: "tools/call", params: { name: "get_me" } },
    ]),
    true,
  );
  assert.equal(
    getCallsProtectedTool([
      { method: "tools/call", params: { name: "open_uploader" } },
    ]),
    false,
  );
});
