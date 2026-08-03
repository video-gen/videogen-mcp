import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SERVER_VERSION, buildMcpServer } from "./buildServer";

describe("MCP tool output schemas", () => {
  it("advertises outputSchema for every HOSTED tool", async () => {
    const server = buildMcpServer(
      () => {
        throw new Error("Tool handlers cannot run while listing tools.");
      },
      "HOSTED",
      null,
      null,
      true,
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "videogen-output-schema-test", version: SERVER_VERSION });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const { tools } = await client.listTools();

      assert.ok(tools.length > 0, "expected at least one tool");

      const missing = tools
        .filter((tool) => tool.outputSchema == null)
        .map((tool) => tool.name);

      assert.deepEqual(
        missing,
        [],
        `tools missing outputSchema: ${missing.join(", ")}`,
      );

      for (const tool of tools) {
        assert.equal(tool.outputSchema?.type, "object", `${tool.name} outputSchema.type`);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
