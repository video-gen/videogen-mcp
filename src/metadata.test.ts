import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { type McpExecutionMode, SERVER_NAME, SERVER_VERSION, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import type { McpHostSurface } from "./hostSurface";

const repeatableMutations = new Set([
  "cancel_workflow_run",
  "cancel_tool_execution",
  "archive_entity",
  "remove_entity_reference",
]);

void test("initialize and tools/list expose complete, bounded metadata on every surface", async () => {
  const executionModes: McpExecutionMode[] = ["LOCAL", "HOSTED"];
  const hostSurfaces: McpHostSurface[] = ["STANDARD", "CHATGPT_APP"];
  for (const executionMode of executionModes) {
    for (const hostSurface of hostSurfaces) {
      const server = buildMcpServer(
        () => assert.fail("Discovery must not access the API"),
        executionMode,
        { resourceMetadataUrl: "https://mcp.videogen.io/.well-known/oauth-protected-resource", scopes: ["email", "profile"] },
        null,
        false,
        hostSurface,
      );
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "metadata-test", version: "1" });
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      try {
        const info = client.getServerVersion();
        assert.equal(info?.name, SERVER_NAME);
        assert.equal(info?.version, SERVER_VERSION);
        assert.equal(info?.title, "VideoGen");
        assert.match(info?.description ?? "", /storyboards/);
        assert.equal(info?.websiteUrl, "https://videogen.io");
        assert.deepEqual(info?.icons, [{
          src: "https://videogen.io/logos/logo-red.svg",
          mimeType: "image/svg+xml",
          sizes: ["any"],
        }]);
        const capabilities = client.getServerCapabilities();
        assert.ok(capabilities?.tools != null);
        assert.ok(capabilities?.resources != null);
        const instructions = client.getInstructions();
        assert.ok(instructions != null);
        assert.ok(Buffer.byteLength(instructions, "utf8") <= 2048);
        assert.ok(instructions.startsWith("Before setup"));

        const { tools } = await client.listTools();
        assert.equal(tools.length, executionMode === "HOSTED" ? 52 : 50);
        for (const tool of tools) {
          assert.ok(Buffer.byteLength(tool.description ?? "", "utf8") <= 2048, tool.name);
          assert.equal(
            tool.annotations?.idempotentHint,
            tool.annotations?.readOnlyHint === true || repeatableMutations.has(tool.name),
            tool.name,
          );
        }
        if (executionMode === "HOSTED") {
          for (const name of ["upload_file", "open_uploader"]) {
            const tool = tools.find((candidate) => candidate.name === name);
            assert.ok(tool != null);
            for (const key of ["openai/toolInvocation/invoking", "openai/toolInvocation/invoked"]) {
              const label = tool._meta?.[key];
              assert.ok(typeof label === "string" && label.length > 0 && label.length <= 64, key);
            }
            assert.ok(tool._meta?.["openai/outputTemplate"] != null);
          }
        }
      } finally {
        await client.close();
        await server.close();
      }
    }
  }
});

void test("cancellation and uploader results satisfy their advertised schemas", async (context) => {
  const apiClient = createVideoGenClientFromToken({ bearerToken: "test-key", baseUrl: "https://unused.invalid" });
  context.mock.method(apiClient.tools, "cancelToolExecution", () => Promise.resolve({ toolExecutionId: "vg_tool_test" }));
  context.mock.method(apiClient.tools, "getToolExecutionInfo", () => Promise.resolve({
    toolExecutionId: "vg_tool_test",
    status: "running",
    toolType: "TEXT_TO_SPEECH",
    progressPercentage: 20,
    attemptIndex: 0,
    results: [],
    error: null,
  }));
  context.mock.method(apiClient.tools, "textToSpeech", () => Promise.resolve({ toolExecutionId: "vg_tool_test" }));
  const server = buildMcpServer(() => apiClient, "HOSTED", null, null, true);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "output-contract-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    const cancelTool = tools.find((tool) => tool.name === "cancel_tool_execution");
    assert.deepEqual(Object.keys(cancelTool?.outputSchema?.properties ?? {}), ["toolExecutionId"]);
    const snapshotTool = tools.find((tool) => tool.name === "get_tool_execution");
    assert.deepEqual(snapshotTool?.outputSchema?.required, [
      "toolExecutionId", "status", "toolType", "progressPercentage", "attemptIndex", "results", "error",
    ]);
    const cancelled = await client.callTool({ name: "cancel_tool_execution", arguments: { toolExecutionId: "vg_tool_test" } });
    assert.notEqual(cancelled.isError, true);
    assert.deepEqual(cancelled.structuredContent, { toolExecutionId: "vg_tool_test" });
    const snapshot = await client.callTool({ name: "get_tool_execution", arguments: { toolExecutionId: "vg_tool_test" } });
    assert.notEqual(snapshot.isError, true);
    assert.equal(z.object({ status: z.literal("running"), results: z.array(z.unknown()) }).safeParse(snapshot.structuredContent).success, true);
    const speech = await client.callTool({ name: "text_to_speech", arguments: { text: "Hello", voiceId: "test-voice" } });
    assert.notEqual(speech.isError, true);
    assert.deepEqual(speech.structuredContent, { toolExecutionId: "vg_tool_test" });
    const opened = await client.callTool({ name: "open_uploader", arguments: {} });
    assert.notEqual(opened.isError, true);
    assert.deepEqual(opened.structuredContent, { status: "ready" });
  } finally {
    await client.close();
    await server.close();
  }
});
