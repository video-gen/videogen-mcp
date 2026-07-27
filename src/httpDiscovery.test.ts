import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";

/**
 * Boots `dist/http.js` over Streamable HTTP and asserts ChatGPT-critical
 * discovery behavior:
 *   - OAuth mode: anonymous initialize / tools/list succeed with schemes
 *   - API-key mode: missing Bearer → HTTP 401 + WWW-Authenticate
 *
 * Requires a prior `pnpm build` in mcp/ (same as the smoke entry).
 */

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const HTTP_ENTRY = join(SERVER_DIR, "..", "dist", "http.js");
const HTTP_HEALTH_TIMEOUT_MS = 15_000;
const OAUTH_ISSUER = "https://example.supabase.co/auth/v1";
const PUBLIC_ORIGIN = "http://127.0.0.1";

const securitySchemesSchema = z.array(
  z.union([
    z.object({ type: z.literal("noauth") }),
    z.object({ type: z.literal("oauth2"), scopes: z.array(z.string()) }),
  ]),
);

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (address == null || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine a free port for the MCP HTTP discovery test."));

        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + HTTP_HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Not accepting connections yet.
    }

    await delay(100);
  }

  throw new Error(`MCP HTTP server did not become healthy on port ${port}.`);
}

function buildChildEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) {
      env[key] = value;
    }
  }

  // Ensure a clean OAuth/API-key mode for this child — drop inherited issuer vars.
  delete env.VIDEOGEN_OAUTH_ISSUER;
  delete env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL;
  delete env.VIDEOGEN_MCP_PUBLIC_ORIGIN;

  return { ...env, ...overrides };
}

async function startHttpServer(envOverrides: Record<string, string>): Promise<{
  port: number;
  child: ChildProcess;
  mcpUrl: string;
  origin: string;
}> {
  if (!existsSync(HTTP_ENTRY)) {
    throw new Error(
      `Missing ${HTTP_ENTRY}. Run \`pnpm build\` in mcp/ before httpDiscovery tests.`,
    );
  }

  const port = await getFreePort();
  const origin = `${PUBLIC_ORIGIN}:${port}`;
  const child = spawn(process.execPath, [HTTP_ENTRY], {
    env: buildChildEnv({
      PORT: String(port),
      VIDEOGEN_BASE_URL: "http://127.0.0.1:9",
      VIDEOGEN_MCP_PUBLIC_ORIGIN: origin,
      ...envOverrides,
    }),
    stdio: ["ignore", "ignore", "pipe"],
  });

  try {
    await waitForHealth(port);
  } catch (err: unknown) {
    child.kill("SIGTERM");
    throw err;
  }

  return { port, child, mcpUrl: `${origin}/mcp`, origin };
}

function stopHttpServer(child: ChildProcess): void {
  child.kill("SIGTERM");
}

function getToolSecuritySchemes(tool: {
  name: string;
  securitySchemes?: unknown;
  _meta?: { securitySchemes?: unknown };
}): unknown {
  return tool.securitySchemes ?? tool._meta?.securitySchemes;
}

/**
 * Posts a JSON-RPC body to `/mcp` with the Accept headers the Streamable HTTP
 * transport requires. Parses either a JSON body or an SSE `data:` frame.
 */
async function postMcpJsonRpc({
  mcpUrl,
  body,
  authorization,
}: {
  mcpUrl: string;
  body: unknown;
  authorization?: string;
}): Promise<{ status: number; wwwAuthenticate: string | null; payload: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (authorization != null) {
    headers.Authorization = authorization;
  }

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  const wwwAuthenticate = response.headers.get("www-authenticate");

  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));

    if (dataLine == null) {
      throw new Error(`MCP response was neither JSON nor SSE data:\n${raw.slice(0, 500)}`);
    }

    payload = JSON.parse(dataLine.slice("data:".length).trim());
  }

  return { status: response.status, wwwAuthenticate, payload };
}

void test("OAuth mode serves anonymous initialize + tools/list with correct securitySchemes", async () => {
  const { child, mcpUrl, origin } = await startHttpServer({
    VIDEOGEN_OAUTH_ISSUER: OAUTH_ISSUER,
  });

  try {
    const prmResponse = await fetch(`${origin}/.well-known/oauth-protected-resource`);
    assert.equal(prmResponse.status, 200);
    const prmBody: unknown = await prmResponse.json();
    assert.ok(prmBody != null && typeof prmBody === "object");
    assert.equal("resource" in prmBody ? prmBody.resource : null, mcpUrl);
    assert.deepEqual(
      "authorization_servers" in prmBody ? prmBody.authorization_servers : null,
      [OAUTH_ISSUER],
    );

    const initialize = await postMcpJsonRpc({
      mcpUrl,
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "http-discovery-test", version: "0" },
        },
      },
    });

    assert.equal(initialize.status, 200);
    assert.ok(
      initialize.payload != null &&
        typeof initialize.payload === "object" &&
        "result" in initialize.payload,
    );

    const client = new Client({ name: "http-discovery-test", version: "1.0.0" });

    try {
      const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
      await client.connect(transport as Transport);

      const { tools } = await client.listTools();
      assert.ok(tools.length >= 30, `expected ≥30 tools, got ${tools.length}`);

      const openUploader = tools.find((tool) => tool.name === "open_uploader");
      const getMe = tools.find((tool) => tool.name === "get_me");

      assert.ok(openUploader != null);
      assert.ok(getMe != null);

      const openUploaderSchemes = securitySchemesSchema.safeParse(
        getToolSecuritySchemes(openUploader),
      );
      const getMeSchemes = securitySchemesSchema.safeParse(getToolSecuritySchemes(getMe));

      assert.ok(openUploaderSchemes.success, "open_uploader must advertise securitySchemes");
      assert.ok(getMeSchemes.success, "get_me must advertise securitySchemes");
      assert.deepEqual(openUploaderSchemes.data, [{ type: "noauth" }]);
      assert.deepEqual(getMeSchemes.data, [{ type: "oauth2", scopes: ["email", "profile"] }]);
    } finally {
      await client.close().catch(() => undefined);
    }
  } finally {
    stopHttpServer(child);
  }
});

void test("API-key-only mode rejects anonymous /mcp with 401 + WWW-Authenticate", async () => {
  const { child, mcpUrl, origin } = await startHttpServer({
    // No VIDEOGEN_OAUTH_ISSUER → API-key-only.
  });

  try {
    const prmResponse = await fetch(`${origin}/.well-known/oauth-protected-resource`);
    assert.equal(prmResponse.status, 404);

    const result = await postMcpJsonRpc({
      mcpUrl,
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      },
    });

    assert.equal(result.status, 401);
    assert.ok(result.wwwAuthenticate != null);
    assert.match(result.wwwAuthenticate, /^Bearer /);
    assert.ok(
      result.payload != null &&
        typeof result.payload === "object" &&
        "error" in result.payload,
    );
  } finally {
    stopHttpServer(child);
  }
});
