import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";

void test("external imports expose choices and import only an explicitly selected video before generation", async (context) => {
  const apiClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "https://unused.invalid",
  });
  const starts = context.mock.method(
    apiClient.files,
    "createFileUrlImport",
    () => Promise.resolve({ fileImportId: "vg_fimp_choice" }),
  );
  const selection = {
    sourceUrl: "https://example.com/post",
    videos: [
      { videoIndex: 1, title: "First", durationSeconds: 18 },
      { videoIndex: 2, title: "Second", durationSeconds: 13 },
    ],
  };
  context.mock.method(apiClient.files, "getFileUrlImport", () =>
    Promise.resolve({
      fileImportId: "vg_fimp_choice",
      status: "failed",
      progressPercentage: 100,
      attemptIndex: 0,
      file: null,
      fileId: null,
      error: { message: "Choose a video." },
      selection,
    }),
  );
  context.mock.method(apiClient.workflows, "videoToVideo", () =>
    assert.fail("Importing must not start video generation"),
  );
  for (const mode of ["LOCAL", "HOSTED"] as const) {
    const server = buildMcpServer(
      () => apiClient,
      mode,
      null,
      null,
      true,
      "CHATGPT_APP",
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "url-import-test", version: "1" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      const start = await client.callTool({
        name: "import_video_from_url",
        arguments: { url: selection.sourceUrl },
      });
      assert.notEqual(start.isError, true);
      assert.deepEqual(starts.mock.calls.at(-1)?.arguments, [
        { url: selection.sourceUrl },
      ]);
      const countBeforePoll = starts.mock.callCount();
      const choices = await client.callTool({
        name: "get_video_url_import",
        arguments: { fileImportId: "vg_fimp_choice" },
      });
      assert.notEqual(choices.isError, true);
      assert.deepEqual(choices.structuredContent, {
        fileImportId: "vg_fimp_choice",
        status: "failed",
        progressPercentage: 100,
        attemptIndex: 0,
        file: null,
        fileId: null,
        error: { message: "Choose a video." },
        selection,
      });
      assert.equal(
        starts.mock.callCount(),
        countBeforePoll,
        "Reading choices cannot select a video",
      );
      const selected = await client.callTool({
        name: "import_video_from_url",
        arguments: { url: selection.sourceUrl, videoIndex: 2 },
      });
      assert.notEqual(selected.isError, true);
      assert.deepEqual(starts.mock.calls.at(-1)?.arguments, [
        { url: selection.sourceUrl, videoIndex: 2 },
      ]);
      for (const videoIndex of [0, -1, 1.5, 21]) {
        const invalid = await client.callTool({
          name: "import_video_from_url",
          arguments: { url: selection.sourceUrl, videoIndex },
        });
        assert.equal(invalid.isError, true);
      }
      assert.equal(starts.mock.callCount(), countBeforePoll + 1);
    } finally {
      await client.close();
      await server.close();
    }
  }
});

void test("a completed video import returns the actual file id and metadata", async (context) => {
  const apiClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "https://unused.invalid",
  });
  const fileId = "vg_file_7XoHR4wyGOlFKNmQeINtl7";
  context.mock.method(apiClient.files, "getFileUrlImport", () =>
    Promise.resolve({
      fileImportId: "vg_fimp_selected",
      status: "succeeded",
      progressPercentage: 100,
      attemptIndex: 0,
      fileId,
      file: {
        fileId,
        type: "VIDEO",
        displayName: "Selected video",
        durationSeconds: 13.7,
      },
      error: null,
    }),
  );
  const server = buildMcpServer(
    () => apiClient,
    "HOSTED",
    null,
    null,
    true,
    "CHATGPT_APP",
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "url-import-result-test", version: "1" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    const result = await client.callTool({
      name: "get_video_url_import",
      arguments: { fileImportId: "vg_fimp_selected" },
    });
    assert.notEqual(result.isError, true);
    const snapshot = z
      .object({
        status: z.literal("succeeded"),
        fileId: z.string(),
        file: z.object({
          fileId: z.string(),
          displayName: z.string(),
          durationSeconds: z.number(),
        }),
      })
      .parse(result.structuredContent);
    assert.equal(snapshot.fileId, fileId);
    assert.equal(snapshot.file.fileId, fileId);
    assert.equal(snapshot.file.displayName, "Selected video");
    assert.equal(snapshot.file.durationSeconds, 13.7);
  } finally {
    await client.close();
    await server.close();
  }
});
