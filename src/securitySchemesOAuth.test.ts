import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import { GUIDANCE_DOCUMENTS } from "./guidance/documents";
import type { McpOAuthContext } from "./operations";
import { mirrorSecuritySchemesToTopLevel } from "./securitySchemes";

const OAUTH_CONTEXT: McpOAuthContext = {
  resourceMetadataUrl: "https://dev.mcp.videogen.io/.well-known/oauth-protected-resource",
  scopes: ["email", "profile"],
};

const securitySchemesSchema = z.array(
  z.union([
    z.object({ type: z.literal("noauth") }),
    z.object({ type: z.literal("oauth2"), scopes: z.array(z.string()) }),
  ]),
);

async function listToolsWithOAuth(): Promise<{
  tools: Array<{
    name: string;
    _meta?: { securitySchemes?: unknown | undefined } | undefined;
  }>;
}> {
  const videoGenClient = createVideoGenClientFromToken({
    bearerToken: "test-key",
    baseUrl: "http://localhost:9999",
  });
  // hasCredentials=false exercises anonymous discovery; listing never calls the API.
  const server = buildMcpServer(() => videoGenClient, "HOSTED", OAUTH_CONTEXT, null, false);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "security-schemes-oauth-test", version: "1.0.0" });
  await client.connect(clientTransport);

  try {
    const listed = await client.listTools();
    return {
      tools: listed.tools.map((tool) => ({
        name: tool.name,
        _meta: tool._meta,
      })),
    };
  } finally {
    await client.close();
  }
}

void test("OAuth-enabled HOSTED tools advertise oauth2 except noauth tools", async () => {
  const { tools } = await listToolsWithOAuth();

  const openUploader = tools.find((tool) => tool.name === "open_uploader");
  const getAppDeepLink = tools.find((tool) => tool.name === "get_app_deep_link");
  const getMe = tools.find((tool) => tool.name === "get_me");

  assert.ok(openUploader != null);
  assert.ok(getAppDeepLink != null);
  assert.ok(getMe != null);

  const openUploaderSchemes = securitySchemesSchema.safeParse(openUploader._meta?.securitySchemes);
  const getAppDeepLinkSchemes = securitySchemesSchema.safeParse(
    getAppDeepLink._meta?.securitySchemes,
  );
  const getMeSchemes = securitySchemesSchema.safeParse(getMe._meta?.securitySchemes);

  assert.ok(openUploaderSchemes.success);
  assert.ok(getAppDeepLinkSchemes.success);
  assert.ok(getMeSchemes.success);
  assert.deepEqual(openUploaderSchemes.data, [{ type: "noauth" }]);
  assert.deepEqual(getAppDeepLinkSchemes.data, [{ type: "noauth" }]);
  assert.deepEqual(getMeSchemes.data, [{ type: "oauth2", scopes: ["email", "profile"] }]);

  for (const doc of GUIDANCE_DOCUMENTS) {
    const guidanceTool = tools.find((tool) => tool.name === doc.toolName);
    assert.ok(guidanceTool != null, `missing guidance tool ${doc.toolName}`);
    const schemes = securitySchemesSchema.safeParse(guidanceTool._meta?.securitySchemes);
    assert.ok(schemes.success, `${doc.toolName} must advertise securitySchemes`);
    assert.deepEqual(schemes.data, [{ type: "noauth" }]);
  }
});

void test("mirrorSecuritySchemesToTopLevel promotes open_uploader noauth and get_me oauth2", async () => {
  const { tools } = await listToolsWithOAuth();

  const mirrored = mirrorSecuritySchemesToTopLevel({
    jsonrpc: "2.0",
    id: 1,
    result: { tools },
  });

  assert.ok("result" in mirrored);
  const result = mirrored.result;
  assert.ok(result != null && typeof result === "object" && "tools" in result);

  const toolsWithTopLevel = z
    .object({
      tools: z.array(
        z.object({
          name: z.string(),
          securitySchemes: securitySchemesSchema.optional(),
        }),
      ),
    })
    .parse(result);

  const openUploader = toolsWithTopLevel.tools.find((tool) => tool.name === "open_uploader");
  const getAppDeepLink = toolsWithTopLevel.tools.find((tool) => tool.name === "get_app_deep_link");
  const getMe = toolsWithTopLevel.tools.find((tool) => tool.name === "get_me");

  assert.deepEqual(openUploader?.securitySchemes, [{ type: "noauth" }]);
  assert.deepEqual(getAppDeepLink?.securitySchemes, [{ type: "noauth" }]);
  assert.deepEqual(getMe?.securitySchemes, [{ type: "oauth2", scopes: ["email", "profile"] }]);
});
