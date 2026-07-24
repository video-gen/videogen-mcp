import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./buildServer";
import { createVideoGenClient } from "./client";
import { readEnv } from "./env";

async function main(): Promise<void> {
  const envResult = readEnv();

  if (!envResult.ok) {
    process.stderr.write(`[videogen-mcp] ${envResult.message}\n`);
    process.exit(1);
  }

  const client = createVideoGenClient(envResult.env);

  // Stdio runs on the caller's own machine with their API key from the
  // environment, so it always has credentials and never runs an OAuth flow. The
  // client is already built (a key is guaranteed), so the factory just returns it.
  const server = buildMcpServer(() => client, "LOCAL", null, null, true);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[videogen-mcp] VideoGen MCP server running on stdio.\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[videogen-mcp] Fatal error: ${message}\n`);
  process.exit(1);
});
