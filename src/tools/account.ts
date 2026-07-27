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
        "Fetch the account and team behind the API key (`apiKeyId`, `apiKeyNickname`, `email`, `displayName`, `teamId`). Use it as a connection test.",
      inputSchema: {},
    },
    async () => await respondSdk(() => getClient().account.getMe()),
  );
}
