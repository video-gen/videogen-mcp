import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { MEDIA_PREVIEW_WIDGET_URI } from "./appWidget";
import { type McpExecutionMode, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import { getHasInlineMediaUrls, jsonResult } from "./result";

async function connectClient(executionMode: McpExecutionMode): Promise<Client> {
  const videoGenClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "http://localhost:9999",
  });
  const server = buildMcpServer(() => videoGenClient, executionMode, null, null, true);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "media-preview-test", version: "1.0.0" });
  await client.connect(clientTransport);

  return client;
}

const mediaPreviewMetaSchema = z.object({
  ui: z.object({ resourceUri: z.string() }),
  "openai/outputTemplate": z.string(),
});

void test("HOSTED server registers media preview resource and generate_image outputTemplate", async () => {
  const client = await connectClient("HOSTED");

  try {
    const { tools } = await client.listTools();
    const generateImage = tools.find((tool) => tool.name === "generate_image");

    assert.ok(generateImage != null, "generate_image should be registered");

    const meta = mediaPreviewMetaSchema.safeParse(generateImage._meta);
    assert.ok(meta.success, "generate_image _meta should link the media preview widget");
    assert.equal(meta.data.ui.resourceUri, MEDIA_PREVIEW_WIDGET_URI);
    assert.equal(meta.data["openai/outputTemplate"], MEDIA_PREVIEW_WIDGET_URI);

    const { resources } = await client.listResources();
    const mediaPreview = resources.find((resource) => resource.uri === MEDIA_PREVIEW_WIDGET_URI);
    assert.ok(mediaPreview != null, "the media preview UI resource should be listed on HOSTED");

    // Official Apps SDK: prefer `_meta.ui.csp`, plus legacy `openai/widgetCSP`
    // (snake_case) for ChatGPT — including `redirect_domains` for openExternal.
    const cspMetaSchema = z.object({
      ui: z.object({
        domain: z.string(),
        csp: z.object({
          connectDomains: z.array(z.string()),
          resourceDomains: z.array(z.string().min(1)).min(1),
        }),
      }),
      "openai/widgetDomain": z.string(),
      "openai/widgetCSP": z.object({
        connect_domains: z.array(z.string()),
        resource_domains: z.array(z.string().min(1)).min(1),
        redirect_domains: z.array(z.string().min(1)).min(1),
      }),
    });
    const cspMeta = cspMetaSchema.safeParse(mediaPreview._meta);
    assert.ok(cspMeta.success, "media preview resource must declare ui.csp + openai/widgetCSP");
    assert.ok(
      cspMeta.data.ui.csp.resourceDomains.some((domain) => domain.includes("mux.com")),
      "resourceDomains must allow Mux signed media hosts",
    );
    assert.ok(
      cspMeta.data.ui.csp.resourceDomains.includes("https://imagedelivery.net"),
      "resourceDomains must allow Cloudflare Images delivery",
    );
    assert.ok(
      cspMeta.data.ui.csp.resourceDomains.includes("https://workspace-storage.videogen.io"),
      "resourceDomains must allow deprecated workspace GCS CDN",
    );
    assert.ok(
      cspMeta.data.ui.csp.resourceDomains.some((domain) =>
        domain.includes("r2.cloudflarestorage.com"),
      ),
      "resourceDomains must allow Cloudflare R2 signed hosts",
    );
  } finally {
    await client.close();
  }
});

void test("LOCAL server does NOT attach media preview meta to generate_image", async () => {
  const client = await connectClient("LOCAL");

  try {
    const { tools } = await client.listTools();
    const generateImage = tools.find((tool) => tool.name === "generate_image");
    assert.ok(generateImage != null);
    assert.equal(generateImage._meta?.["openai/outputTemplate"], undefined);
  } finally {
    await client.close();
  }
});

void test("jsonResult tags media payloads with the preview outputTemplate", () => {
  assert.equal(getHasInlineMediaUrls({ status: "running" }), false);

  const withUrl = {
    status: "succeeded",
    results: [{ type: "IMAGE", downloadUrl: "https://storage.googleapis.com/x" }],
  };
  assert.equal(getHasInlineMediaUrls(withUrl), true);

  const result = jsonResult(withUrl);
  assert.equal(result._meta?.["openai/outputTemplate"], MEDIA_PREVIEW_WIDGET_URI);
  assert.deepEqual(result.structuredContent, withUrl);
});
