import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MEDIA_PREVIEW_TOOL_META } from "./appWidget";
import type { McpExecutionMode } from "./buildServer";
import type { GetVideoGenClient } from "./client";
import { registerGuidance } from "./guidance/registerGuidance";
import type { McpHostSurface } from "./hostSurface";
import type { McpOperations } from "./operations";
import { registerAccountTools } from "./tools/account";
import { registerAppDeepLinkTool } from "./tools/appDeepLink";
import { registerEntityTools } from "./tools/entities";
import { registerFileTools } from "./tools/files";
import { registerMediaPreviewWidget } from "./tools/mediaPreviewWidget";
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
  hostSurface: McpHostSurface,
): void {
  const mediaPreviewMeta = executionMode === "HOSTED" ? MEDIA_PREVIEW_TOOL_META : null;

  // Public docs (no API credential). Register first so discovery lists them
  // ahead of credit-spending tools.
  registerGuidance(server, hostSurface);

  registerWorkflowTools(server, getClient, operations);
  registerMediaToolTools(server, getClient, operations, mediaPreviewMeta);
  registerProjectTools(server, getClient, operations, mediaPreviewMeta);
  registerFileTools(server, getClient, executionMode, operations, mediaPreviewMeta);
  registerEntityTools(server, getClient, operations);
  registerResourceTools(server, getClient, operations);
  registerAccountTools(server, getClient, operations);
  registerAppDeepLinkTool(server, hostSurface);

  // ChatGPT App widgets need the MCP Apps host bridge (`window.openai`), which
  // only the HOSTED (Streamable HTTP) transport is reached through.
  if (executionMode === "HOSTED") {
    registerUploadWidget(server);
    registerMediaPreviewWidget(server);
  }
}
