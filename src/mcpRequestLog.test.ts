import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMcpRequestLogLine,
  getHasToolAuthChallenge,
  getMcpMethodFromBody,
  getToolNameFromCallBody,
  getToolNamesFromListResult,
} from "./mcpRequestLog";

void test("getMcpMethodFromBody reads the JSON-RPC method", () => {
  assert.equal(getMcpMethodFromBody({ jsonrpc: "2.0", id: 1, method: "tools/list" }), "tools/list");
  assert.equal(getMcpMethodFromBody({ method: "initialize" }), "initialize");
  assert.equal(getMcpMethodFromBody(null), null);
  assert.equal(getMcpMethodFromBody({ jsonrpc: "2.0", id: 1 }), null);
});

void test("getToolNameFromCallBody reads tools/call params.name", () => {
  assert.equal(
    getToolNameFromCallBody({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "storyboard_to_video", arguments: {} },
    }),
    "storyboard_to_video",
  );
  assert.equal(getToolNameFromCallBody({ method: "tools/list" }), null);
});

void test("getToolNamesFromListResult extracts names from a tools/list result", () => {
  assert.deepEqual(
    getToolNamesFromListResult({
      tools: [{ name: "get_me" }, { name: "open_uploader" }],
    }),
    ["get_me", "open_uploader"],
  );
  assert.equal(getToolNamesFromListResult({ tools: "nope" }), null);
  assert.equal(getToolNamesFromListResult({ content: [] }), null);
});

void test("getHasToolAuthChallenge detects mcp/www_authenticate on a tool result", () => {
  assert.equal(
    getHasToolAuthChallenge({
      isError: true,
      content: [{ type: "text", text: "Sign in" }],
      _meta: { "mcp/www_authenticate": ['Bearer resource_metadata="https://example/prm"'] },
    }),
    true,
  );
  assert.equal(getHasToolAuthChallenge({ tools: [] }), false);
  assert.equal(getHasToolAuthChallenge({ _meta: { securitySchemes: [] } }), false);
});

void test("formatMcpRequestLogLine writes structured fields without secrets", () => {
  const line = formatMcpRequestLogLine({
    method: "tools/list",
    httpStatus: 200,
    hasAuthorization: false,
    toolNames: ["get_me", "script_to_video"],
    authChallengeEmitted: false,
  });

  assert.ok(line.includes("method=tools/list"));
  assert.ok(line.includes("httpStatus=200"));
  assert.ok(line.includes("hasAuthorization=false"));
  assert.ok(line.includes("toolCount=2"));
  assert.ok(line.includes("toolNames=get_me,script_to_video"));
  assert.ok(line.includes("authChallengeEmitted=false"));
  assert.ok(!line.toLowerCase().includes("bearer "));
  assert.ok(!line.includes("sk_"));
});
