import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  appDeepLinkActionFromToolArgs,
  buildAppDeepLinkUrl,
} from "../appDeepLink";
import { getAppDeepLinkInputSchema } from "../inputSchemas";
import { getAppDeepLinkOutputSchema } from "../outputSchemas";
import { errorResult, jsonResult } from "../result";

/**
 * Registers `get_app_deep_link`: returns an absolute VideoGen app (or public
 * docs) URL for assistant COMMON actions (upgrade, invite, navigate, …). The
 * authenticated app consumes `vg_action=…` query params after sign-in.
 *
 * No VideoGen API call — advertised `noauth` so ChatGPT can surface the link
 * before OAuth linking.
 */
export function registerAppDeepLinkTool(server: McpServer): void {
  server.registerTool(
    "get_app_deep_link",
    {
      title: "Get app deep link",
      description:
        "Build a VideoGen app URL that opens a modal or navigates after the user signs in (upgrade, buy credits, invite teammates, submit feedback, integrations, account settings, or a NAVIGATE destination). Prefer this when the user needs to complete something in the VideoGen UI that MCP tools cannot do inline. Return the url to the user so they can open it.",
      inputSchema: getAppDeepLinkInputSchema,
      outputSchema: getAppDeepLinkOutputSchema,
      _meta: {
        securitySchemes: [{ type: "noauth" }],
      },
    },
    (args) => {
      const action = appDeepLinkActionFromToolArgs(args);
      if (action == null) {
        return errorResult(
          "Invalid deep-link arguments. For NAVIGATE pass destination; for OPEN_HELP_ARTICLE pass articleSlug; for OPEN_MANAGE_INTEGRATION pass provider.",
        );
      }

      return jsonResult({
        url: buildAppDeepLinkUrl(action),
        action: action.type,
      });
    },
  );
}
