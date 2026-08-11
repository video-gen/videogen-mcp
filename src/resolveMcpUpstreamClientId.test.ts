import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMcpUpstreamClientId } from "./resolveMcpUpstreamClientId";

test("resolveMcpUpstreamClientId forces chatgpt on the ChatGPT Apps path", () => {
  assert.equal(
    resolveMcpUpstreamClientId({
      mcpPath: "/mcp/chatgpt",
      requestUrl: "/mcp/chatgpt?vg_client=cursor",
      requestHeaders: { "x-videogen-client": "raycast" },
    }),
    "chatgpt",
  );
});

test("resolveMcpUpstreamClientId prefers the X-VideoGen-Client header", () => {
  assert.equal(
    resolveMcpUpstreamClientId({
      mcpPath: "/mcp",
      requestUrl: "/mcp?vg_client=claude",
      requestHeaders: { "x-videogen-client": "raycast" },
    }),
    "raycast",
  );
});

test("resolveMcpUpstreamClientId falls back to vg_client query param", () => {
  assert.equal(
    resolveMcpUpstreamClientId({
      mcpPath: "/mcp",
      requestUrl: "/mcp?vg_client=claude",
      requestHeaders: {},
    }),
    "claude",
  );
});

test("resolveMcpUpstreamClientId ignores unknown client ids", () => {
  assert.equal(
    resolveMcpUpstreamClientId({
      mcpPath: "/mcp",
      requestUrl: "/mcp?vg_client=not-a-real-client",
      requestHeaders: { "x-videogen-client": "also-fake" },
    }),
    "mcp",
  );
});

test("resolveMcpUpstreamClientId ignores unknown vg_client when header is absent", () => {
  assert.equal(
    resolveMcpUpstreamClientId({
      mcpPath: "/mcp",
      requestUrl: "/mcp?vg_client=CLAUDE_CODE",
      requestHeaders: {},
    }),
    "mcp",
  );
});

test("resolveMcpUpstreamClientId defaults to mcp", () => {
  assert.equal(
    resolveMcpUpstreamClientId({
      mcpPath: "/mcp",
      requestUrl: "/mcp",
      requestHeaders: {},
    }),
    "mcp",
  );
});
