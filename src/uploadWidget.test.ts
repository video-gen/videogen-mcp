import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { UPLOAD_WIDGET_URI } from "./appWidget";
import { type McpExecutionMode, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";

/**
 * Connects an MCP client to a fresh server over an in-memory transport pair, so
 * we can assert what the server advertises (`tools/list`, `resources/list`)
 * without a network transport or a real API key. Listing never invokes the
 * VideoGen client, so the dummy key is never used.
 */
async function connectClient(executionMode: McpExecutionMode): Promise<Client> {
  const videoGenClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "http://localhost:9999",
  });
  const server = buildMcpServer(() => videoGenClient, executionMode, null, null, true);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "upload-widget-test", version: "1.0.0" });
  await client.connect(clientTransport);

  return client;
}

const openUploaderMetaSchema = z.object({
  ui: z.object({ resourceUri: z.string() }),
  "openai/outputTemplate": z.string(),
});

void test("HOSTED server registers the open_uploader tool linked to the widget resource", async () => {
  const client = await connectClient("HOSTED");

  try {
    const { tools } = await client.listTools();
    const openUploader = tools.find((tool) => tool.name === "open_uploader");

    assert.ok(openUploader != null, "open_uploader should be registered on HOSTED");

    // The render tool must point at the widget resource via both the MCP Apps
    // standard key (`ui.resourceUri`) and ChatGPT's alias (`openai/outputTemplate`).
    const meta = openUploaderMetaSchema.safeParse(openUploader._meta);
    assert.ok(meta.success, "open_uploader _meta should carry the UI resource links");
    assert.equal(meta.data.ui.resourceUri, UPLOAD_WIDGET_URI);
    assert.equal(meta.data["openai/outputTemplate"], UPLOAD_WIDGET_URI);

    const { resources } = await client.listResources();
    assert.ok(
      resources.some((resource) => resource.uri === UPLOAD_WIDGET_URI),
      "the widget UI resource should be listed on HOSTED",
    );
  } finally {
    await client.close();
  }
});

void test("LOCAL server does NOT register the open_uploader tool", async () => {
  const client = await connectClient("LOCAL");

  try {
    const { tools } = await client.listTools();

    assert.equal(
      tools.some((tool) => tool.name === "open_uploader"),
      false,
      "open_uploader relies on the ChatGPT Apps host and must be HOSTED-only",
    );
  } finally {
    await client.close();
  }
});
