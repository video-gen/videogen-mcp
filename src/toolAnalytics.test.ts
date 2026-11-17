import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { observeMcpTools, sendMcpToolAnalytics, type McpToolAnalyticsEvent } from "./toolAnalytics";

void test("analytics preserves discovery/results and records validation and tool failures", async () => {
  const events: McpToolAnalyticsEvent[] = [];
  const server = new McpServer({ name: "analytics-test", version: "1" });
  observeMcpTools(server, (event) => {
    events.push(event);
    return Promise.resolve();
  });
  const expected: CallToolResult = {
    content: [{ type: "text", text: "private result" }],
    structuredContent: { projectId: "project-a", status: "running", downloadUrl: "private-url" },
  };
  server.registerTool("generate", {
    inputSchema: { projectId: z.string(), prompt: z.string() },
  }, () => expected);
  server.registerTool("failed", { inputSchema: {} }, () => ({
    content: [{ type: "text", text: "private failure" }], isError: true,
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const tools = await client.listTools();
    assert.deepEqual(tools.tools[0]?.inputSchema.required, ["projectId", "prompt"]);
    assert.equal(JSON.stringify(tools).includes("conversation_id"), false);
    assert.equal(events.length, 0);
    const result = await client.callTool({
      name: "generate", arguments: { projectId: "project-a", prompt: "private prompt" },
    });
    assert.deepEqual(result, expected);
    await client.callTool({ name: "failed", arguments: {} });
    await client.callTool({ name: "generate", arguments: {} });
    assert.deepEqual(events.map((event) => event.isError), [false, true, true]);
    assert.deepEqual(events[0]?.inputReferences, { projectId: "project-a" });
    assert.deepEqual(events[0]?.outputReferences, { projectId: "project-a", status: "running" });
    assert.equal(JSON.stringify(events).includes("private"), false);
    assert.ok(events.every((event) => event.durationMs >= 0));
    assert.equal((await client.callTool({ name: "unknown", arguments: {} })).isError, true);
    assert.equal(events.length, 3);
  } finally {
    await client.close();
    await server.close();
  }
});

void test("an analytics failure preserves successful and failed tool results", async () => {
  const server = new McpServer({ name: "analytics-test", version: "1" });
  observeMcpTools(server, () => Promise.reject(new TypeError("analytics unavailable")));
  server.registerTool("ok", { inputSchema: {} }, () => ({ content: [] }));
  server.registerTool("throws", { inputSchema: {} }, () => {
    throw new TypeError("original failure");
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    assert.deepEqual(await client.callTool({ name: "ok", arguments: {} }), { content: [] });
    const result = await client.callTool({ name: "throws", arguments: {} });
    assert.equal(result.isError, true);
    assert.deepEqual(result.content, [{ type: "text", text: "original failure" }]);
  } finally {
    await client.close();
    await server.close();
  }
});

void test("hosted analytics uses the existing bearer only for our receiver and never follows redirects", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", (url: unknown, options: RequestInit) => {
    assert.equal(url, "https://api.example.test/internal/mcp-analytics");
    assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, {
      authorization: "Bearer synthetic-token",
      "content-type": "application/json",
      "x-videogen-client": "cursor",
    });
    assert.ok(typeof options.body === "string");
    assert.equal(options.body.includes("synthetic-token"), false);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  await sendMcpToolAnalytics({
    baseUrl: "https://api.example.test/", bearerToken: "synthetic-token", clientName: "cursor",
    event: {
      eventId: "test", toolName: "get_me", startedAtMse: 1, durationMs: 2, isError: false,
      inputReferences: {}, outputReferences: {},
    },
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

void test("network failure in the hosted sender fails open and omits error details", async (t) => {
  t.mock.method(globalThis, "fetch", () => Promise.reject(new TypeError("synthetic-private-token")));
  const diagnostics: string[] = [];
  t.mock.method(process.stderr, "write", (chunk: string) => {
    diagnostics.push(chunk);
    return true;
  });
  await sendMcpToolAnalytics({
    baseUrl: "https://api.example.test", bearerToken: "synthetic-private-token", clientName: "cursor",
    event: {
      eventId: "test", toolName: "get_me", startedAtMse: 1, durationMs: 2, isError: false,
      inputReferences: {}, outputReferences: {},
    },
  });
  assert.deepEqual(diagnostics, ["[videogen-mcp] Failed to send tool analytics.\n"]);
});
