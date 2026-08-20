import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { UPLOAD_WIDGET_URI } from "../appWidget";
import { type McpExecutionMode, buildMcpServer } from "../buildServer";
import { createVideoGenClientFromToken } from "../client";
import {
  getServerInstructionsForHostSurface,
  type McpHostSurface,
} from "../hostSurface";
import {
  GUIDANCE_DOCUMENTS,
  GUIDANCE_MIME_TYPE,
  getGuidanceDocuments,
} from "./documents";

async function connectClient(
  executionMode: McpExecutionMode,
  hostSurface: McpHostSurface = "STANDARD",
): Promise<Client> {
  const videoGenClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "http://localhost:9999",
  });
  const server = buildMcpServer(
    () => videoGenClient,
    executionMode,
    null,
    null,
    true,
    hostSurface,
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "guidance-test", version: "1.0.0" });
  await client.connect(clientTransport);

  return client;
}

function getTextContent(content: unknown): string {
  assert.ok(Array.isArray(content), "tool result content should be an array");
  const first = content[0];
  assert.ok(
    first != null && typeof first === "object" && "type" in first && first.type === "text",
    "guidance tools should return a text content block",
  );
  assert.ok("text" in first && typeof first.text === "string");
  return first.text;
}

void test("LOCAL and HOSTED advertise all guidance resources", async () => {
  for (const executionMode of ["LOCAL", "HOSTED"] as const) {
    const client = await connectClient(executionMode);

    try {
      const { resources } = await client.listResources();
      const uris = new Set(resources.map((resource) => resource.uri));

      for (const doc of GUIDANCE_DOCUMENTS) {
        assert.ok(
          uris.has(doc.uri),
          `${executionMode} resources/list should include ${doc.uri}`,
        );

        const listed = resources.find((resource) => resource.uri === doc.uri);
        assert.ok(listed != null);
        assert.equal(listed.mimeType, GUIDANCE_MIME_TYPE);
      }
    } finally {
      await client.close();
    }
  }
});

void test("resources/read returns the same markdown as the mirror guidance tools", async () => {
  const client = await connectClient("LOCAL");

  try {
    const { tools } = await client.listTools();
    const toolNames = new Set(tools.map((tool) => tool.name));

    for (const doc of GUIDANCE_DOCUMENTS) {
      assert.ok(toolNames.has(doc.toolName), `missing tool ${doc.toolName}`);

      const read = await client.readResource({ uri: doc.uri });
      assert.equal(read.contents.length, 1);
      const resourceContent = read.contents[0];
      assert.ok(resourceContent != null);
      assert.ok("text" in resourceContent && typeof resourceContent.text === "string");
      assert.equal(resourceContent.mimeType, GUIDANCE_MIME_TYPE);
      assert.equal(resourceContent.text, doc.markdown);
      assert.ok(resourceContent.text.includes("Fast Path"));

      const toolResult = await client.callTool({ name: doc.toolName, arguments: {} });
      assert.notEqual(toolResult.isError, true);
      assert.equal(getTextContent(toolResult.content), doc.markdown);
      assert.deepEqual(toolResult.structuredContent, { markdown: doc.markdown });
    }
  } finally {
    await client.close();
  }
});

void test("HOSTED still lists widget resources alongside guidance", async () => {
  const client = await connectClient("HOSTED");

  try {
    const { resources } = await client.listResources();
    assert.ok(resources.some((resource) => resource.uri === UPLOAD_WIDGET_URI));
    assert.ok(resources.some((resource) => resource.uri === "guidance://getting-started"));
  } finally {
    await client.close();
  }
});

void test("async-tasks guidance and server instructions set honest generation waits", () => {
  const [asyncTasks] = getGuidanceDocuments({ hostSurface: "STANDARD" }).filter(
    (doc) => doc.id === "async-tasks",
  );
  assert.ok(asyncTasks != null);
  assert.match(asyncTasks.markdown, /honest time expectation/i);
  assert.match(asyncTasks.markdown, /2–5 minutes/);

  const instructions = getServerInstructionsForHostSurface({ hostSurface: "CHATGPT_APP" });
  assert.match(instructions, /2–5 minutes/);
  assert.match(instructions, /Do not imply a clip will be ready in a few seconds/);
});

void test("STANDARD getting-started credits guidance walks into upgrade deep links", () => {
  const [gettingStarted] = getGuidanceDocuments({ hostSurface: "STANDARD" }).filter(
    (doc) => doc.id === "getting-started",
  );
  assert.ok(gettingStarted != null);
  assert.match(gettingStarted.markdown, /OPEN_UPGRADE/);
  assert.match(gettingStarted.markdown, /OPEN_PURCHASE_CREDITS/);
  assert.match(gettingStarted.markdown, /OPEN_ENABLE_TOP_UPS/);
});

void test("ChatGPT getting-started credits guidance never mentions purchase verbs", async () => {
  const [gettingStarted] = getGuidanceDocuments({ hostSurface: "CHATGPT_APP" }).filter(
    (doc) => doc.id === "getting-started",
  );
  assert.ok(gettingStarted != null);
  assert.match(gettingStarted.markdown, /manage their VideoGen account/);
  assert.equal(/buy|purchase|upgrade|top-?ups?/i.test(gettingStarted.markdown), false);

  const client = await connectClient("HOSTED", "CHATGPT_APP");
  try {
    const toolResult = await client.callTool({
      name: "get_getting_started_guidance",
      arguments: {},
    });
    assert.notEqual(toolResult.isError, true);
    const text = getTextContent(toolResult.content);
    assert.equal(/buy|purchase|upgrade|top-?ups?/i.test(text), false);
    assert.match(text, /manage their VideoGen account/);
  } finally {
    await client.close();
  }
});

void test("ChatGPT get_app_deep_link omits and rejects commerce actions", async () => {
  const client = await connectClient("HOSTED", "CHATGPT_APP");

  try {
    const { tools } = await client.listTools();
    const deepLink = tools.find((tool) => tool.name === "get_app_deep_link");
    assert.ok(deepLink != null);
    const actionSchema = deepLink.inputSchema;
    assert.ok(actionSchema != null && typeof actionSchema === "object");
    const actionProperty =
      "properties" in actionSchema &&
      actionSchema.properties != null &&
      typeof actionSchema.properties === "object" &&
      "action" in actionSchema.properties
        ? actionSchema.properties.action
        : null;
    assert.ok(actionProperty != null && typeof actionProperty === "object");
    const enumValues =
      "enum" in actionProperty && Array.isArray(actionProperty.enum)
        ? actionProperty.enum
        : null;
    assert.ok(enumValues != null);
    assert.equal(enumValues.includes("OPEN_UPGRADE"), false);
    assert.equal(enumValues.includes("OPEN_PURCHASE_CREDITS"), false);
    assert.equal(enumValues.includes("OPEN_ENABLE_TOP_UPS"), false);
    assert.equal(enumValues.includes("OPEN_RATE_CARD"), false);

    const rejected = await client.callTool({
      name: "get_app_deep_link",
      arguments: { action: "OPEN_UPGRADE" },
    });
    // Schema validation or the ChatGPT handler reject — either way, no commerce URL.
    assert.equal(rejected.isError, true);
    const rejectedText = getTextContent(rejected.content);
    assert.equal(/vg_action=OPEN_UPGRADE/i.test(rejectedText), false);
    assert.equal(/buy credits|purchase credits/i.test(rejectedText), false);
  } finally {
    await client.close();
  }
});
