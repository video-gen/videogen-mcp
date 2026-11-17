import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { VideoGen } from "@videogen/sdk";
import { z } from "zod";
import { buildMcpServer } from "./buildServer";
import {
  EditVideoCommandsRequestSchema,
  GetProjectArtifactResponseSchema,
} from "./generated/projectEditingSchemas";
import { ApplyProjectEditsRequestSchema } from "./generated/projectCommandSchemas";

test("the MCP editing request stays identical to the public API contract", () => {
  const api = JSON.parse(
    readFileSync(
      new URL(
        "../../api/src/generated/openapi-component-json-schemas.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [name, definition] of Object.entries({
    EditVideoCommandsRequest: EditVideoCommandsRequestSchema,
    ApplyProjectEditsRequest: ApplyProjectEditsRequestSchema,
    GetProjectArtifactResponse: GetProjectArtifactResponseSchema,
  })) {
    const { $schema, ...schema } = z.toJSONSchema(definition);
    assert.deepEqual(schema, api[name], `${name} diverged from the public API`);
  }
});

test("ordinary MCP calls preserve target, request identity and revision without a widget", async (t) => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const mutationId = "799996da-6c9c-4296-b500-f8c5abb69712";
  const projectId = "vg_proj_0000000000000000000001";
  const editableVideoId = "vg_vide_0000000000000000000002";
  t.mock.method(
    globalThis,
    "fetch",
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = new URL(String(input));
      const body = init?.body == null ? null : JSON.parse(String(init.body));
      calls.push({
        path: url.pathname + url.search,
        method: init?.method ?? "GET",
        body,
      });
      return new Response(
        JSON.stringify(
          url.pathname.endsWith("/inspection")
            ? {
                projectId,
                editableVideoId,
                revision: 12,
                aspectRatio: { width: 16, height: 9 },
                captionStyle: {
                  fontFamily: "Inter",
                  fontSize: 48,
                  fontWeight: 400,
                  textColor: "#ffffff",
                  textAlpha: 1,
                },
                globalLayers: [],
                totalGlobalLayers: 0,
                nextGlobalLayersOffset: null,
                totalSections: 0,
                nextOffset: null,
                pageKind: "TRANSCRIPT_WORDS",
                totalItems: 0,
                offset: 0,
                textOffset: 0,
                sections: [],
                evidence: {
                  source: "timeline",
                  composedFrames: "unavailable",
                  audio: "unavailable",
                },
              }
            : {
                projectId,
                editableVideoId,
                mutationId,
                outcome: "APPLIED",
                projectRevision: 12,
              },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  const server = buildMcpServer(
    () =>
      new VideoGen({ apiKey: "test", baseUrl: "https://editing.example.test" }),
    "HOSTED",
    null,
    null,
    true,
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "plain-editing-host", version: "1" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    const { tools } = await client.listTools();
    const edit = tools.find((tool) => tool.name === "edit_video");
    assert.ok(edit);
    assert.equal(edit.annotations?.readOnlyHint, false);
    assert.equal(edit.annotations?.idempotentHint, true);
    assert.ok(
      Buffer.byteLength(JSON.stringify(edit.inputSchema)) <= 32_000,
      "editing schema exceeded the literal 32 KB budget",
    );
    assert.equal(
      tools.find((tool) => tool.name === "inspect_video")?.annotations
        ?.readOnlyHint,
      true,
    );
    const request = {
      projectId,
      editableVideoId,
      mode: "COMMANDS",
      mutationId,
      expectedRevision: 11,
      commands: [{ type: "SET_CAPTIONS", enabled: true }],
    };
    const first = await client.callTool({
      name: "edit_video",
      arguments: request,
    });
    const repeated = await client.callTool({
      name: "edit_video",
      arguments: request,
    });
    assert.equal(first.isError, undefined);
    assert.deepEqual(first.structuredContent, repeated.structuredContent);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], {
      path: `/v1/projects/${projectId}/videos/${editableVideoId}/edits`,
      method: "POST",
      body: {
        mode: "COMMANDS",
        mutationId,
        expectedRevision: 11,
        commands: request.commands,
      },
    });
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(first._meta?.["openai/outputTemplate"], undefined);
    const inspected = await client.callTool({
      name: "inspect_video",
      arguments: {
        projectId,
        editableVideoId,
        assetId: "asset-one",
        expectedRevision: 12,
      },
    });
    assert.equal(inspected.isError, undefined);
    assert.equal(calls[2]?.method, "GET");
    assert.equal(calls[2]?.body, null);
    const inspectionUrl = new URL(
      calls[2]?.path ?? "",
      "https://editing.example.test",
    );
    assert.equal(inspectionUrl.searchParams.get("assetId"), "asset-one");
    assert.equal(inspectionUrl.searchParams.get("expectedRevision"), "12");
  } finally {
    await client.close();
    await server.close();
  }
});
