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

void test("HOSTED server registers media preview resource without descriptor-level generate widgets", async () => {
  const client = await connectClient("HOSTED");

  try {
    const { tools } = await client.listTools();
    const generateImage = tools.find((tool) => tool.name === "generate_image");

    assert.ok(generateImage != null, "generate_image should be registered");
    assert.equal(
      generateImage._meta?.["openai/outputTemplate"],
      undefined,
      "generate_image must not declare openai/outputTemplate (ChatGPT would spawn an empty widget on start)",
    );

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
    assert.ok(
      cspMeta.data.ui.csp.resourceDomains.includes("https://storage-download.videogen.io"),
      "resourceDomains must allow the storage-download Worker host",
    );
    assert.ok(
      cspMeta.data["openai/widgetCSP"].redirect_domains.includes("https://app.videogen.io"),
      "redirect_domains must allow opening the VideoGen Media app URL",
    );
    assert.equal(
      cspMeta.data["openai/widgetCSP"].redirect_domains.some((domain) =>
        domain.includes("r2.cloudflarestorage.com"),
      ),
      false,
      "redirect_domains must not allow signed R2 URLs (ChatGPT breaks signatures)",
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

void test("jsonResult enriches appMediaUrl without attaching a preview widget by default", () => {
  assert.equal(getHasInlineMediaUrls({ status: "running" }), false);

  const withUrl = {
    status: "succeeded",
    results: [
      {
        type: "IMAGE",
        fileId: "vg_file_7XoHR4wyGOlFKNmQeINtl7",
        downloadUrl: "https://storage.googleapis.com/x",
      },
    ],
  };
  assert.equal(getHasInlineMediaUrls(withUrl), true);

  const result = jsonResult(withUrl);
  assert.equal(result._meta?.["openai/outputTemplate"], undefined);
  assert.deepEqual(result.structuredContent, {
    status: "succeeded",
    results: [
      {
        type: "IMAGE",
        fileId: "vg_file_7XoHR4wyGOlFKNmQeINtl7",
        downloadUrl: "https://storage.googleapis.com/x",
        appMediaUrl:
          "http://localhost:3000/media?storageFileId=vg_file_7XoHR4wyGOlFKNmQeINtl7",
      },
    ],
  });
});

void test("jsonResult attaches the preview widget only when opted in", () => {
  const withUrl = {
    status: "succeeded",
    results: [
      {
        type: "IMAGE",
        fileId: "vg_file_7XoHR4wyGOlFKNmQeINtl7",
        downloadUrl: "https://storage.googleapis.com/x",
      },
    ],
  };

  const result = jsonResult(withUrl, { attachMediaPreviewWidget: true });
  assert.equal(result._meta?.["openai/outputTemplate"], MEDIA_PREVIEW_WIDGET_URI);
});

void test("HOSTED generate and poll tools do not declare the media preview on the tool descriptor", async () => {
  const client = await connectClient("HOSTED");

  try {
    const { tools } = await client.listTools();
    const noDescriptorWidgetTools = [
      "generate_image",
      "generate_motion_graphic",
      "generate_video_clip",
      "export_project",
      "get_tool_execution",
      "get_file",
      "get_project_export",
    ];

    for (const name of noDescriptorWidgetTools) {
      const tool = tools.find((entry) => entry.name === name);
      assert.ok(tool != null, `${name} should be registered`);
      assert.equal(
        tool._meta?.["openai/outputTemplate"],
        undefined,
        `${name} must not declare openai/outputTemplate (each ChatGPT call would spawn a new widget)`,
      );
    }
  } finally {
    await client.close();
  }
});
