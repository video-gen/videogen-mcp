import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { UPLOAD_WIDGET_URI } from "./appWidget";
import { type McpExecutionMode, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import type { McpHostSurface } from "./hostSurface";

/**
 * Connects an MCP client to a fresh server over an in-memory transport pair, so
 * we can assert what the server advertises (`tools/list`, `resources/list`)
 * without a network transport or a real API key. Listing never invokes the
 * VideoGen client, so the dummy key is never used.
 */
async function connectClient(
  executionMode: McpExecutionMode,
  hostSurface: McpHostSurface = "STANDARD",
): Promise<Client> {
  const videoGenClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "http://localhost:9999",
  });
  const server = buildMcpServer(() => videoGenClient, executionMode, null, null, true, hostSurface);

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

function readToolMeta(tool: { _meta?: unknown }): {
  ui: { visibility: string[] | null; resourceUri: string | null } | null;
  widgetAccessible: boolean | null;
  fileParams: string[] | null;
} {
  if (tool._meta == null) {
    return { ui: null, widgetAccessible: null, fileParams: null };
  }

  const parsed = z
    .object({
      ui: z
        .object({
          visibility: z.array(z.string()).optional(),
          resourceUri: z.string().optional(),
        })
        .optional(),
      "openai/widgetAccessible": z.boolean().optional(),
      "openai/fileParams": z.array(z.string()).optional(),
    })
    .safeParse(tool._meta);

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    return { ui: null, widgetAccessible: null, fileParams: null };
  }

  return {
    ui:
      parsed.data.ui == null
        ? null
        : {
            visibility: parsed.data.ui.visibility ?? null,
            resourceUri: parsed.data.ui.resourceUri ?? null,
          },
    widgetAccessible: parsed.data["openai/widgetAccessible"] ?? null,
    fileParams: parsed.data["openai/fileParams"] ?? null,
  };
}

void test("ChatGPT hides direct upload tools from the model and accepts attached files", async () => {
  const client = await connectClient("HOSTED", "CHATGPT_APP");

  try {
    const { tools } = await client.listTools();
    const openUploader = tools.find((tool) => tool.name === "open_uploader");
    const createFileUpload = tools.find((tool) => tool.name === "create_file_upload");
    const uploadFile = tools.find((tool) => tool.name === "upload_file");
    const getFile = tools.find((tool) => tool.name === "get_file");

    assert.ok(openUploader != null);
    assert.ok(createFileUpload != null);
    assert.ok(uploadFile != null);
    assert.ok(getFile != null);

    const openMeta = readToolMeta(openUploader);
    assert.deepEqual(openMeta.fileParams, ["files"]);
    assert.equal(openMeta.ui?.resourceUri, UPLOAD_WIDGET_URI);

    for (const tool of [createFileUpload, uploadFile]) {
      const meta = readToolMeta(tool);
      assert.deepEqual(meta.ui?.visibility, ["app"]);
      assert.equal(meta.widgetAccessible, true);
    }

    assert.equal(readToolMeta(getFile).ui, null);

    const fileItem = z
      .object({
        properties: z.object({
          files: z.object({
            items: z.object({
              additionalProperties: z.literal(false),
              required: z.array(z.string()),
              properties: z.object({
                download_url: z.object({ type: z.literal("string") }),
                file_id: z.object({ type: z.literal("string") }),
                mime_type: z.object({ type: z.literal("string") }),
                file_name: z.object({ type: z.literal("string") }),
              }),
            }),
          }),
        }),
      })
      .safeParse(openUploader.inputSchema);

    assert.equal(fileItem.success, true);

    if (fileItem.success) {
      assert.deepEqual(fileItem.data.properties.files.items.required, ["download_url", "file_id"]);
    }

    const opened = await client.callTool({
      name: "open_uploader",
      arguments: {
        files: [
          {
            download_url: "https://files.oaiusercontent.com/photo",
            file_id: "file_photo",
            file_name: "IMG_1320.jpeg",
          },
        ],
      },
    });
    assert.notEqual(opened.isError, true);
    assert.deepEqual(opened.structuredContent, { status: "ready" });
  } finally {
    await client.close();
  }
});

void test("STANDARD hosted upload tools stay model-visible and do not take ChatGPT file params", async () => {
  const client = await connectClient("HOSTED", "STANDARD");

  try {
    const { tools } = await client.listTools();
    const openUploader = tools.find((tool) => tool.name === "open_uploader");
    const createFileUpload = tools.find((tool) => tool.name === "create_file_upload");

    assert.ok(openUploader != null);
    assert.ok(createFileUpload != null);
    assert.equal(readToolMeta(openUploader).fileParams, null);
    assert.equal(readToolMeta(createFileUpload).ui, null);
    assert.equal(JSON.stringify(openUploader.inputSchema).includes("\"download_url\""), false);
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
