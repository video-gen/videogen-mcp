import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetVideoGenClient } from "../client";
import type { McpOperations } from "../operations";

export function registerAccountTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: McpOperations,
): void {
  server.registerTool(
    "get_me",
    {
      title: "Get account",
      description:
        "Fetch the authenticated team's account details, including the current credit balance.",
      inputSchema: {},
    },
    async () => await respondSdk(() => getClient().account.getMe()),
  );
}
