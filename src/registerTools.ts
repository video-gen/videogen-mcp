import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpExecutionMode } from "./buildServer";
import type { GetVideoGenClient } from "./client";
import type { McpOperations } from "./operations";
import { registerAccountTools } from "./tools/account";
import { registerFileTools } from "./tools/files";
import { registerMediaToolTools } from "./tools/mediaTools";
import { registerProjectTools } from "./tools/projects";
import { registerResourceTools } from "./tools/resources";
import { registerUploadWidget } from "./tools/uploadWidget";
import { registerWorkflowTools } from "./tools/workflows";

export function registerTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  executionMode: McpExecutionMode,
  operations: McpOperations,
): void {
  registerWorkflowTools(server, getClient, operations);
  registerMediaToolTools(server, getClient, operations);
  registerProjectTools(server, getClient, operations);
  registerFileTools(server, getClient, executionMode, operations);
  registerResourceTools(server, getClient, operations);
  registerAccountTools(server, getClient, operations);

  // The ChatGPT App upload widget needs the MCP Apps host bridge (`window.openai`),
  // which only the HOSTED (Streamable HTTP) transport is reached through; the
  // LOCAL stdio transport uploads by file path instead.
  if (executionMode === "HOSTED") {
    registerUploadWidget(server);
  }
}
