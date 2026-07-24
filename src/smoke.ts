import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { runFullCoverage } from "./fullSmoke.js";

/**
 * Standalone smoke test for the VideoGen MCP server. Exercises the server over a
 * real MCP client (the same SDK Cursor/Claude use) across either transport:
 *
 *   node dist/smoke.js --transport stdio   # spawns dist/index.js, talks over stdio
 *   node dist/smoke.js --transport http    # spawns dist/http.js, talks over streamable HTTP
 *
 * By default the `http` transport spawns a local `dist/http.js` server and talks
 * to it over a loopback port. To instead exercise an already-deployed server
 * (e.g. dev.mcp.videogen.io) without spawning anything locally, pass its MCP
 * endpoint URL:
 *
 *   node dist/smoke.js --transport http --mcp-url https://dev.mcp.videogen.io/mcp
 *
 * (or set MCP_SERVER_URL). `--mcp-url` is only valid with `--transport http`;
 * `stdio` always runs the server as a local subprocess.
 *
 * Configuration mirrors the server itself:
 *   VIDEOGEN_API_KEY   (required) — the key the client authenticates with
 *   VIDEOGEN_BASE_URL  (optional) — upstream VideoGen API (defaults to production);
 *                                   ignored when --mcp-url targets a deployed server
 *
 * Coverage (--coverage, or MCP_SMOKE_COVERAGE):
 *   basic (default) — verifies the handshake, that `tools/list` exposes the
 *     expected tools, and a read-only `get_me` (spends no credits).
 *   full — additionally exercises EVERY hosted tool with real requests (uploads,
 *     all media/generation tools, all workflows, project edit + export). This
 *     spends credits and can take a long time; it is meant for the "run all
 *     tests" background job, not a quick check.
 *
 * Exits 0 on success, 1 on failure.
 */

const DEFAULT_BASE_URL = "https://api.videogen.io";

// Tools that must always be present, spanning every registrar group. `get_me` is
// also the connectivity probe below.
const EXPECTED_TOOLS = ["get_me", "list_tts_voices", "script_to_video", "generate_image"];

// Read-only, zero-credit call that proves the key authenticates against the API.
const VERIFY_TOOL = "get_me";

const HTTP_HEALTH_TIMEOUT_MS = 15_000;

type TransportKind = "stdio" | "http";

type Coverage = "basic" | "full";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function parseTransport(): TransportKind {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--transport");
  const value = flagIndex >= 0 ? args[flagIndex + 1] : process.env.MCP_SMOKE_TRANSPORT;

  if (value === "stdio" || value === "http") {
    return value;
  }

  console.error(`[mcp-smoke] --transport must be "stdio" or "http" (got ${String(value)})`);
  process.exit(1);
}

/**
 * The MCP endpoint URL of an already-deployed server to test against, from
 * `--mcp-url` (or the `MCP_SERVER_URL` env). When set, the http transport
 * connects directly to it instead of spawning a local server. Returns null when
 * not provided (spawn-a-local-server mode).
 */
function parseRemoteServerUrl(): string | null {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--mcp-url");
  const value = flagIndex >= 0 ? args[flagIndex + 1] : process.env.MCP_SERVER_URL;
  const trimmed = value?.trim();

  return trimmed != null && trimmed !== "" ? trimmed : null;
}

/** Reads the coverage level from `--coverage` (or MCP_SMOKE_COVERAGE), defaulting to `basic`. */
function parseCoverage(): Coverage {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf("--coverage");
  const value = flagIndex >= 0 ? args[flagIndex + 1] : process.env.MCP_SMOKE_COVERAGE;

  if (value === "full") {
    return "full";
  }

  if (value == null || value === "" || value === "basic") {
    return "basic";
  }

  console.error(`[mcp-smoke] --coverage must be "basic" or "full" (got ${value})`);
  process.exit(1);
}

/** Snapshots process.env into a defined-only record, then layers overrides on top. */
function buildChildEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) {
      env[key] = value;
    }
  }

  return { ...env, ...overrides };
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();

      if (address == null || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine a free port for the MCP HTTP server."));

        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Server not accepting connections yet; retry until the deadline.
    }

    await delay(200);
  }

  throw new Error(`MCP HTTP server did not become healthy on port ${port} within ${timeoutMs}ms.`);
}

function stringifyContent(content: unknown): string {
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

async function main(): Promise<void> {
  const transportKind = parseTransport();
  const remoteServerUrl = parseRemoteServerUrl();
  const coverage = parseCoverage();

  if (remoteServerUrl != null && transportKind === "stdio") {
    console.error(
      "[mcp-smoke] --mcp-url is only supported with --transport http (stdio always runs the server as a local subprocess).",
    );
    process.exit(1);
  }

  // Full coverage exercises HOSTED-only tools (inline base64 upload_file, the
  // open_uploader widget) so it requires the HTTP transport.
  if (coverage === "full" && transportKind === "stdio") {
    console.error(
      "[mcp-smoke] --coverage full requires --transport http (it exercises HOSTED-only tools like open_uploader).",
    );
    process.exit(1);
  }

  const apiKey = process.env.VIDEOGEN_API_KEY?.trim();

  if (apiKey == null || apiKey === "") {
    console.error(
      "[mcp-smoke] VIDEOGEN_API_KEY is required. Create a key at https://app.videogen.io/developers.",
    );
    process.exit(1);
  }

  const baseUrl = process.env.VIDEOGEN_BASE_URL?.trim() ?? "";
  const resolvedBaseUrl = baseUrl !== "" ? baseUrl : DEFAULT_BASE_URL;

  const serverDir = dirname(fileURLToPath(import.meta.url));

  console.log(
    remoteServerUrl != null
      ? `[mcp-smoke] transport=${transportKind} coverage=${coverage} mcpUrl=${remoteServerUrl} (deployed server)`
      : `[mcp-smoke] transport=${transportKind} coverage=${coverage} baseUrl=${resolvedBaseUrl}`,
  );

  const client = new Client({ name: "videogen-mcp-smoke", version: "1.0.0" });
  let httpChild: ChildProcess | undefined;

  try {
    if (transportKind === "stdio") {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(serverDir, "index.js")],
        env: buildChildEnv({ VIDEOGEN_API_KEY: apiKey, VIDEOGEN_BASE_URL: resolvedBaseUrl }),
        stderr: "inherit",
      });

      await client.connect(transport);
    } else {
      // Target either the already-deployed server (--mcp-url) or a freshly
      // spawned local server. In the deployed case nothing is spawned, so we
      // never need the local `http.js` build (or its @videogen/sdk dist).
      const mcpUrl = await (async (): Promise<string> => {
        if (remoteServerUrl != null) {
          return remoteServerUrl;
        }

        const port = await getFreePort();

        httpChild = spawn(process.execPath, [join(serverDir, "http.js")], {
          env: buildChildEnv({ PORT: String(port), VIDEOGEN_BASE_URL: resolvedBaseUrl }),
          stdio: ["ignore", "inherit", "inherit"],
        });

        await waitForHealth(port, HTTP_HEALTH_TIMEOUT_MS);

        return `http://localhost:${port}/mcp`;
      })();

      const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
      });

      // The SDK's StreamableHTTPClientTransport exposes a `sessionId` getter typed
      // `string | undefined`, which doesn't satisfy its own `Transport` interface
      // (optional `sessionId?: string`) under this package's exactOptionalPropertyTypes.
      // It is the canonical client transport, so cast it for connect().
      await client.connect(transport as Transport);
    }

    const toolsResult = await client.listTools();
    const toolNames = new Set(toolsResult.tools.map((tool) => tool.name));
    console.log(`[mcp-smoke] tools/list → ${toolNames.size} tools`);

    const missingTools = EXPECTED_TOOLS.filter((name) => !toolNames.has(name));

    if (missingTools.length > 0) {
      throw new Error(`tools/list is missing expected tools: ${missingTools.join(", ")}`);
    }

    const verifyResult = await client.callTool({ name: VERIFY_TOOL, arguments: {} });

    if (verifyResult.isError === true) {
      throw new Error(
        `callTool ${VERIFY_TOOL} returned an error: ${stringifyContent(verifyResult.content)}`,
      );
    }

    console.log(`[mcp-smoke] callTool ${VERIFY_TOOL} → ok`);

    if (coverage === "full") {
      await runFullCoverage({
        client,
        log: (message: string) => console.log(message),
        toolNames,
      });
    }

    console.log(
      remoteServerUrl != null
        ? `[mcp-smoke] PASS (transport=${transportKind}, coverage=${coverage}, mcpUrl=${remoteServerUrl})`
        : `[mcp-smoke] PASS (transport=${transportKind}, coverage=${coverage}, baseUrl=${resolvedBaseUrl})`,
    );
  } finally {
    await client.close().catch(() => undefined);

    if (httpChild != null) {
      httpChild.kill("SIGTERM");
    }
  }
}

main().catch((err: unknown) => {
  console.error(`[mcp-smoke] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
