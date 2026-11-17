/** Actual discovery metadata for the payment evals. Never contacts the developer API. */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "./buildServer";
import { BILLING_TOOL_NAMES } from "./tools/billing";

const main = async (): Promise<void> => {
  const catalogs: Record<string, unknown> = {};
  for (const hostSurface of ["STANDARD", "CHATGPT_APP"] satisfies Array<
    "STANDARD" | "CHATGPT_APP"
  >) {
    const server = buildMcpServer(
      () => assert.fail("Discovery must not access an account"),
      "HOSTED",
      null,
      null,
      false,
      hostSurface,
    );
    const client = new Client({ name: "payment-eval-discovery", version: "1" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const { tools } = await client.listTools();
      catalogs[hostSurface] = tools.filter(
        ({ name }) =>
          BILLING_TOOL_NAMES.includes(name) || name === "storyboard_to_video",
      );
    } finally {
      await client.close();
      await server.close();
    }
  }
  process.stdout.write(JSON.stringify(catalogs) + "\n");
};
main().catch(() => {
  process.stderr.write("Payment eval tool discovery failed.\n");
  process.exitCode = 1;
});
