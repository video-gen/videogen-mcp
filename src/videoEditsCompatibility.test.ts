import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { VideoGen } from "@videogen/sdk";
import { buildMcpServer } from "./buildServer";

test("only canonical edits are discovered while legacy calls retain their endpoint and shape", async (t) => {
  const calls: { path: string; body: unknown }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const path = new URL(String(input)).pathname;
      calls.push({
        path,
        body: init?.body == null ? null : JSON.parse(String(init.body)),
      });
      return new Response(
        JSON.stringify(
          path.endsWith("/remix")
            ? {
                projectId: "project",
                projectUrl: "https://videogen.io/project",
                remixActionIds: ["legacy"],
              }
            : {
                projectId: "project",
                projectUrl: "https://videogen.io/project",
                videoEditIds: ["edit"],
              },
        ),
        { headers: { "content-type": "application/json" } },
      );
    },
  );
  const server = buildMcpServer(
    () => new VideoGen({ apiKey: "test", baseUrl: "https://example.test" }),
    "LOCAL",
    null,
    null,
    true,
  );
  const client = new Client({ name: "compatibility-test", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listing = await client.listTools();
    const names = listing.tools.map((tool) => tool.name);
    assert.ok(names.includes("start_video_edits"));
    assert.ok(names.includes("list_video_edits"));
    assert.ok(!names.includes("remix_project"));
    assert.ok(!names.includes("list_project_remix_actions"));
    const canonical = await client.callTool({
      name: "start_video_edits",
      arguments: {
        projectId: "project",
        editableVideoId: "video-a",
        videoEdits: [{ type: "ENABLE_CAPTIONS" }],
      },
    });
    assert.notEqual(canonical.isError, true);
    assert.deepEqual(calls[0], {
      path: "/v1/projects/project/video-edits",
      body: {
        editableVideoId: "video-a",
        videoEdits: [{ type: "ENABLE_CAPTIONS" }],
      },
    });
    const legacy = await client.callTool({
      name: "remix_project",
      arguments: { projectId: "project", edits: ["CAPTIONS"] },
    });
    assert.notEqual(legacy.isError, true);
    assert.deepEqual(calls[1], {
      path: "/v1/projects/project/remix",
      body: { remixActions: [{ type: "ENABLE_CAPTIONS" }] },
    });
  } finally {
    await client.close();
    await server.close();
  }
});
