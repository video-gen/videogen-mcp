import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CREATIVE_TOOL_OPENAPI_CONTRACTS,
  collectCreativeToolOpenApiAlignmentIssues,
} from "./creativeToolAlignment";
import { generateMotionGraphicInputSchema } from "./creativeToolContracts";
import { SERVER_VERSION, buildMcpServer } from "../buildServer";
import { createVideoGenClientFromToken } from "../client";

const OPENAPI_COMPONENT_SCHEMAS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../api/src/generated/openapi-component-json-schemas.json",
);

describe("creative MCP ↔ OpenAPI alignment", () => {
  it("strips stale published-schema fields instead of rejecting the call", () => {
    const parsed = generateMotionGraphicInputSchema.parse({
      prompt: "Countdown from 10.",
      wait: true,
      numResults: 3,
      isOutputTemporary: true,
      subToolModes: { generateVideoClips: "AUTO" },
    });

    assert.deepEqual(parsed, {
      prompt: "Countdown from 10.",
      transparentBackground: true,
      subToolModes: { generateVideoClips: "AUTO" },
    });
  });

  it("advertises only OpenAPI request fields (or declared aliases)", async () => {
    const openApiComponentSchemas: unknown = JSON.parse(
      readFileSync(OPENAPI_COMPONENT_SCHEMAS_PATH, "utf8"),
    );

    const server = buildMcpServer(
      () =>
        createVideoGenClientFromToken({
          bearerToken: "test-token",
          baseUrl: "https://example.com",
        }),
      "HOSTED",
      null,
      null,
      true,
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "creative-alignment-test", version: SERVER_VERSION });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const { tools } = await client.listTools();
      const issues = collectCreativeToolOpenApiAlignmentIssues({
        tools,
        openApiComponentSchemas,
      });

      assert.deepEqual(issues, []);

      const listedCreativeNames = new Set(
        tools
          .map((tool) => tool.name)
          .filter((name) =>
            CREATIVE_TOOL_OPENAPI_CONTRACTS.some((contract) => contract.toolName === name),
          ),
      );
      assert.equal(listedCreativeNames.size, CREATIVE_TOOL_OPENAPI_CONTRACTS.length);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
