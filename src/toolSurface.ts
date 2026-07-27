/**
 * Prints the HOSTED tool surface — every descriptor `tools/list` returns to a
 * remote host such as ChatGPT — as JSON on stdout.
 *
 * Release tooling only: `api/scripts/publish-chatgpt-app.ts` spawns this to
 * detect whether the tool surface changed since the ChatGPT app was last
 * updated by hand. It is deliberately NOT a tsup entry, so it never ships in
 * `dist` or on npm.
 *
 * Run: pnpm exec tsx mcp/src/toolSurface.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SERVER_VERSION, buildMcpServer } from "./buildServer";

async function main(): Promise<void> {
  const server = buildMcpServer(
    // Discovery never invokes a tool handler, so no credential is needed. This
    // factory exists only to satisfy the signature and must never be called.
    () => {
      throw new Error("Tool handlers cannot run while listing the tool surface.");
    },
    "HOSTED",
    // No OAuth context: it only adds `_meta.securitySchemes`, which is identical
    // for every tool and embeds an environment-specific metadata URL that would
    // make the printed surface differ per environment.
    null,
    null,
    true,
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "videogen-tool-surface", version: SERVER_VERSION });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const { tools } = await client.listTools();
    process.stdout.write(`${JSON.stringify({ tools }, null, 2)}\n`);
  } finally {
    await client.close();
    await server.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
