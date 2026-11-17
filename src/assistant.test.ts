import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { VideoGenError } from "@videogen/sdk";
import { z } from "zod";
import { buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";

const project = { assistantId: "vg_asst_existing", projectId: "vg_proj_existing", projectUrl: "https://app.videogen.io/project/existing" };
const reply = {
  messageId: "vg_mesg_reply",
  role: "assistant",
  status: "succeeded",
  content: "Review the proposed edit.",
  attachments: [],
  workflowSuggestions: [],
  actions: [
    { actionId: "edit-1", kind: "APPLY_EDIT", label: "Update the script", requiresApp: false },
    { actionId: "app-1", kind: "OPEN_IN_APP", label: "Generate video", requiresApp: true },
  ],
  generation: null,
  error: null,
  createdAt: 1_794_414_000,
};

void test("assistant delegation preserves its project, pending reply, explicit actions and final results", async (context) => {
  const apiClient = createVideoGenClientFromToken({ bearerToken: "test-key", baseUrl: "https://unused.invalid" });
  const starts = context.mock.method(apiClient.assistant, "startAssistantChat", () => Promise.resolve({ ...project, messageId: reply.messageId }));
  const sends = context.mock.method(apiClient.assistant, "sendAssistantMessage", () => Promise.resolve({ messageId: reply.messageId }));
  const reads = context.mock.method(apiClient.assistant, "getAssistant", () => Promise.resolve({ ...project, messages: [reply] }));
  const polls = context.mock.method(apiClient.assistant, "getAssistantMessage", () => Promise.resolve({ ...reply, status: "running", content: null, actions: [] }));
  const decisions = context.mock.method(apiClient.assistant, "actOnAssistantAction", () => Promise.resolve({ messageId: "vg_mesg_ack" }));
  const server = buildMcpServer(() => apiClient, "HOSTED", null, null, true, "CHATGPT_APP");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "assistant-lifecycle-test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const started = await client.callTool({ name: "start_assistant_chat", arguments: { message: "Draft a product ad. Do not generate yet." } });
    assert.notEqual(started.isError, true);
    assert.deepEqual(started.structuredContent, { ...project, messageId: reply.messageId });
    assert.deepEqual(starts.mock.calls[0]?.arguments, [{ message: "Draft a product ad. Do not generate yet.", autoGenerate: false }]);
    assert.equal(polls.mock.callCount(), 0, "A start returns before polling, on both transports");

    const pending = await client.callTool({ name: "get_assistant_message", arguments: { messageId: reply.messageId } });
    assert.notEqual(pending.isError, true);
    const pendingSnapshot = z.object({ status: z.string(), content: z.string().nullable() }).parse(pending.structuredContent);
    assert.equal(pendingSnapshot.status, "running");
    assert.equal(pendingSnapshot.content, null);
    assert.deepEqual(polls.mock.calls[0]?.arguments, [{ messageId: reply.messageId }]);
    assert.equal(starts.mock.callCount(), 1, "Polling never creates another project");

    const chat = await client.callTool({ name: "get_assistant", arguments: { assistantId: project.assistantId } });
    assert.notEqual(chat.isError, true);
    assert.deepEqual(chat.structuredContent, { ...project, messages: [reply] });
    assert.deepEqual(reads.mock.calls[0]?.arguments, [{ assistantId: project.assistantId }]);
    assert.equal(decisions.mock.callCount(), 0, "Reading proposed actions does not approve them");

    const sent = await client.callTool({ name: "send_assistant_message", arguments: { assistantId: project.assistantId, message: "Keep the same product and shorten the script." } });
    assert.notEqual(sent.isError, true);
    assert.deepEqual(sends.mock.calls[0]?.arguments, [{ assistantId: project.assistantId, message: "Keep the same product and shorten the script." }]);
    assert.equal(starts.mock.callCount(), 1, "Continuing a project never starts a new chat");

    for (const decision of ["REJECT", "APPROVE"]) {
      const args = { assistantId: project.assistantId, actionId: "edit-1", decision };
      const result = await client.callTool({ name: "act_on_assistant_action", arguments: args });
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, { messageId: "vg_mesg_ack" });
      assert.deepEqual(decisions.mock.calls.at(-1)?.arguments, [args]);
    }

    const generation = { workflowRunId: "vg_work_exact", projectId: project.projectId, projectUrl: project.projectUrl, remixActionIds: [] };
    context.mock.method(apiClient.assistant, "getAssistantMessage", () => Promise.resolve({ ...reply, generation }));
    const finished = await client.callTool({ name: "get_assistant_message", arguments: { messageId: reply.messageId } });
    assert.notEqual(finished.isError, true);
    assert.deepEqual(finished.structuredContent, { ...reply, generation });
    assert.equal(decisions.mock.callCount(), 2, "Finishing a reply does not approve further actions");

    const error = { code: "assistant_failed", message: "The assistant could not complete the request." };
    context.mock.method(apiClient.assistant, "getAssistantMessage", () => Promise.resolve({ ...reply, status: "failed", error }));
    const failed = await client.callTool({ name: "get_assistant_message", arguments: { messageId: reply.messageId } });
    assert.notEqual(failed.isError, true, "A failed job remains an inspectable snapshot");
    const failedSnapshot = z.object({ status: z.string(), error: z.object({ code: z.string(), message: z.string() }) }).parse(failed.structuredContent);
    assert.equal(failedSnapshot.status, "failed");
    assert.deepEqual(failedSnapshot.error, error);
  } finally {
    await client.close();
    await server.close();
  }
});

void test("assistant tools enforce nonempty input and an explicit approval decision before API access", async () => {
  for (const mode of ["LOCAL", "HOSTED"] as const) {
    const server = buildMcpServer(() => assert.fail("Invalid inputs must not reach the API"), mode, null, null, true);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "assistant-validation-test", version: "1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const { tools } = await client.listTools();
      for (const name of ["start_assistant_chat", "get_assistant", "send_assistant_message", "get_assistant_message", "act_on_assistant_action"]) {
        assert.ok(tools.some((tool) => tool.name === name));
      }
      for (const call of [
        { name: "start_assistant_chat", arguments: { message: "   " } },
        { name: "get_assistant", arguments: { assistantId: "" } },
        { name: "send_assistant_message", arguments: { assistantId: project.assistantId, message: "" } },
        { name: "get_assistant_message", arguments: { messageId: "" } },
        { name: "act_on_assistant_action", arguments: { assistantId: project.assistantId, actionId: "edit-1" } },
      ]) {
        assert.equal((await client.callTool(call)).isError, true, call.name);
      }
    } finally {
      await client.close();
      await server.close();
    }
  }
});

void test("assistant authorization and app-only rejections retain the existing API boundary", async (context) => {
  const apiClient = createVideoGenClientFromToken({ bearerToken: "test-key", baseUrl: "https://unused.invalid" });
  context.mock.method(apiClient.assistant, "getAssistant", () => Promise.reject(new VideoGenError({ message: "No assistant found with that id.", status: 404, body: null, requestId: null })));
  context.mock.method(apiClient.assistant, "sendAssistantMessage", () => Promise.reject(new VideoGenError({ message: "No access.", status: 403, body: null, requestId: null })));
  context.mock.method(apiClient.assistant, "actOnAssistantAction", () => Promise.reject(new VideoGenError({ message: "This action can only be completed in the VideoGen web app.", status: 422, body: null, requestId: null })));
  context.mock.method(apiClient.assistant, "getAssistantMessage", () => Promise.reject(new VideoGenError({ message: "Token expired.", status: 401, body: null, requestId: null })));
  const oauth = { resourceMetadataUrl: "https://mcp.videogen.io/.well-known/oauth-protected-resource", scopes: ["email", "profile"] };
  for (const hasCredentials of [true, false]) {
    const server = buildMcpServer(() => {
      assert.equal(hasCredentials, true, "Anonymous tools must challenge before constructing the client");
      return apiClient;
    }, "HOSTED", oauth, null, hasCredentials, "CHATGPT_APP");
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "assistant-auth-test", version: "1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      for (const call of [
        { name: "start_assistant_chat", arguments: { message: "Draft a video" } },
        { name: "get_assistant", arguments: { assistantId: project.assistantId } },
        { name: "send_assistant_message", arguments: { assistantId: project.assistantId, message: "Edit this video" } },
        { name: "act_on_assistant_action", arguments: { assistantId: project.assistantId, actionId: "app-1", decision: "APPROVE" } },
        { name: "get_assistant_message", arguments: { messageId: reply.messageId } },
      ].filter((call) => !hasCredentials || call.name !== "start_assistant_chat")) {
        const result = await client.callTool(call);
        assert.equal(result.isError, true, call.name);
        assert.equal(result.structuredContent, undefined);
        if (!hasCredentials || call.name === "get_assistant_message") {
          assert.ok(result._meta?.["mcp/www_authenticate"] != null, call.name);
        } else {
          assert.equal(result._meta?.["mcp/www_authenticate"], undefined, "Resource failures must not trigger sign-in");
        }
      }
    } finally {
      await client.close();
      await server.close();
    }
  }
});
