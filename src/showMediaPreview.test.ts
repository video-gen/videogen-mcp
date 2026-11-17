import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { MEDIA_PREVIEW_WIDGET_URI } from "./appWidget";
import { buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";

void test("render tool displays authorized files, refreshes URLs, and never starts generation", async (context) => {
  const apiClient = createVideoGenClientFromToken({ bearerToken: "test-key", baseUrl: "https://unused.invalid" });
  const reads: string[] = [];
  const hydrations: string[] = [];
  context.mock.method(apiClient.files, "getFile", ({ fileId }: { fileId: string }) => {
    reads.push(fileId);
    return Promise.resolve({ fileId, type: "IMAGE", displayName: "Actual bottle", downloadSource: { status: "pending", url: null } });
  });
  context.mock.method(apiClient.files, "hydrateFile", ({ fileId }: { fileId: string }) => {
    hydrations.push(fileId);
    return Promise.resolve({ fileId, type: "IMAGE", displayName: "Actual bottle", downloadUrl: "https://media.example/actual.png", downloadSource: { status: "ready", url: "https://media.example/actual.png" } });
  });
  context.mock.method(apiClient.tools, "generateImage", () => assert.fail("Rendering must not generate"));
  const server = buildMcpServer(() => apiClient, "HOSTED", null, null, true, "CHATGPT_APP");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "render-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    const render = tools.find((tool) => tool.name === "show_media_preview");
    assert.equal(render?._meta?.["openai/outputTemplate"], MEDIA_PREVIEW_WIDGET_URI);
    assert.deepEqual(render?._meta?.ui, { resourceUri: MEDIA_PREVIEW_WIDGET_URI });
    assert.equal(render?.annotations?.readOnlyHint, true);
    const fileId = "vg_file_7XoHR4wyGOlFKNmQeINtl7";
    const result = await client.callTool({ name: "show_media_preview", arguments: { fileIds: [fileId, fileId] } });
    assert.notEqual(result.isError, true);
    assert.deepEqual(reads, [fileId]);
    assert.deepEqual(hydrations, [fileId]);
    const output = z.object({ results: z.array(z.object({ file: z.object({ fileId: z.string(), displayName: z.string(), downloadUrl: z.string(), appMediaUrl: z.string() }) })) }).parse(result.structuredContent);
    assert.equal(output.results.length, 1);
    assert.equal(output.results[0]?.file.downloadUrl, "https://media.example/actual.png");
    assert.equal(output.results[0]?.file.displayName, "Actual bottle");
    assert.equal(output.results[0]?.file.fileId, fileId);

    const denied = Object.assign(new TypeError("No access"), { statusCode: 403 });
    context.mock.method(apiClient.files, "getFile", () => Promise.reject(denied));
    const inaccessible = await client.callTool({ name: "show_media_preview", arguments: { fileIds: [fileId] } });
    assert.equal(inaccessible.isError, true);
    assert.equal(inaccessible.structuredContent, undefined);
  } finally {
    await client.close();
    await server.close();
  }
});

void test("render tool is absent on stdio and validates its bounded file selection", async () => {
  for (const mode of ["LOCAL", "HOSTED"] as const) {
    const server = buildMcpServer(() => assert.fail("Invalid input must not access the API"), mode, null, null, true);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "render-input-test", version: "1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const { tools } = await client.listTools();
      assert.equal(tools.some((tool) => tool.name === "show_media_preview"), mode === "HOSTED");
      if (mode === "HOSTED") {
        for (const fileIds of [[], [""], Array.from({ length: 13 }, () => "vg_file_test")]) {
          const result = await client.callTool({ name: "show_media_preview", arguments: { fileIds } });
          assert.equal(result.isError, true);
        }
      }
    } finally {
      await client.close();
      await server.close();
    }
  }
});
