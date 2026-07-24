import assert from "node:assert/strict";
import { test } from "node:test";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { mirrorSecuritySchemesToTopLevel } from "./securitySchemes";

const SECURITY_SCHEMES = [{ type: "oauth2", scopes: ["email", "profile"] }];

/** Reads back the tools of a mirrored `tools/list` response without `as`/`is`. */
const mirroredToolsSchema = z.looseObject({
  result: z.looseObject({
    tools: z.array(
      z.looseObject({
        name: z.string(),
        title: z.string().optional(),
        securitySchemes: z.unknown(),
        _meta: z.unknown(),
      }),
    ),
  }),
});

function toolsListResponse(tools: unknown[]): JSONRPCMessage {
  return { jsonrpc: "2.0", id: 1, result: { tools } };
}

void test("mirrors _meta.securitySchemes to a top-level securitySchemes on each tool", () => {
  const input = toolsListResponse([
    {
      name: "get_me",
      title: "Get account",
      description: "Fetch the account.",
      inputSchema: { type: "object" },
      _meta: { securitySchemes: SECURITY_SCHEMES },
    },
  ]);

  const parsed = mirroredToolsSchema.parse(mirrorSecuritySchemesToTopLevel(input));
  const tool = parsed.result.tools[0];

  assert.ok(tool != null);
  // Top-level securitySchemes is what OpenAI's Apps SDK reads.
  assert.deepEqual(tool.securitySchemes, SECURITY_SCHEMES);
  // The _meta mirror is preserved for backward compatibility.
  assert.deepEqual(tool._meta, { securitySchemes: SECURITY_SCHEMES });
  // Other descriptor fields survive untouched.
  assert.equal(tool.title, "Get account");
});

void test("leaves a tool without an advertised scheme untouched", () => {
  const input = toolsListResponse([
    { name: "open_uploader", title: "Upload a file", inputSchema: { type: "object" } },
  ]);

  const parsed = mirroredToolsSchema.parse(mirrorSecuritySchemesToTopLevel(input));
  const tool = parsed.result.tools[0];

  assert.ok(tool != null);
  assert.equal(tool.securitySchemes, undefined);
  assert.equal(tool._meta, undefined);
});

void test("passes a non-response message (e.g. a request) through unchanged", () => {
  const request: JSONRPCMessage = { jsonrpc: "2.0", id: 7, method: "tools/list" };

  assert.deepEqual(mirrorSecuritySchemesToTopLevel(request), request);
});

void test("passes a response without a tools array through unchanged", () => {
  const response: JSONRPCMessage = { jsonrpc: "2.0", id: 3, result: { ok: true } };

  assert.deepEqual(mirrorSecuritySchemesToTopLevel(response), response);
});
