import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  appDeepLinkActionFromToolArgs,
  buildAppDeepLinkUrl,
} from "../appDeepLink";
import {
  CHATGPT_APP_COMMERCE_DEEP_LINK_REJECTED_MESSAGE,
  type McpHostSurface,
  getIsChatGptForbiddenNavigateDestination,
  getIsMcpCommerceDeepLinkAction,
} from "../hostSurface";
import {
  getAppDeepLinkInputSchema,
  getChatGptAppDeepLinkInputSchema,
} from "../inputSchemas";
import { getAppDeepLinkOutputSchema } from "../outputSchemas";
import { errorResult, jsonResult } from "../result";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";

const STANDARD_DEEP_LINK_DESCRIPTION =
  "Build a VideoGen app URL that opens a modal or navigates after the user signs in (upgrade, buy credits, enable top-ups, invite teammates, submit feedback, integrations, account settings, or a NAVIGATE destination). Prefer this when the user needs to complete something in the VideoGen UI that MCP tools cannot do inline — especially credits or plan gates. Return the url to the user so they can open it.";

const CHATGPT_APP_DEEP_LINK_DESCRIPTION =
  "Build a VideoGen app URL that opens a non-billing modal or navigates after the user signs in (invite teammates, submit feedback, integrations, account settings, or a NAVIGATE destination). Prefer this when the user needs to complete something in the VideoGen UI that MCP tools cannot do inline. For credits or plan access issues, do not use this tool: tell the user to open https://app.videogen.io and manage their VideoGen account. Return the url to the user so they can open it.";

/**
 * Registers `get_app_deep_link`: returns an absolute VideoGen app (or public
 * docs) URL for assistant COMMON actions. The authenticated app consumes
 * `vg_action=…` query params after sign-in.
 *
 * On `CHATGPT_APP` (`/mcp/chatgpt`), commerce actions (upgrade / purchase
 * credits / enable top-ups / rate card) and `NAVIGATE` → `BILLING_SETTINGS` are
 * omitted from the advertised schema and rejected if called — OpenAI Plugins
 * policy forbids directing users to buy digital goods. See
 * `.cursor/rules/chatgpt-mcp-no-commerce.mdc`.
 *
 * No VideoGen API call — advertised `noauth` so ChatGPT can surface the link
 * before OAuth linking.
 */
export function registerAppDeepLinkTool(
  server: McpServer,
  hostSurface: McpHostSurface,
): void {
  const isChatGptApp = hostSurface === "CHATGPT_APP";

  server.registerTool(
    "get_app_deep_link",
    {
      title: "Get app deep link",
      description: isChatGptApp
        ? CHATGPT_APP_DEEP_LINK_DESCRIPTION
        : STANDARD_DEEP_LINK_DESCRIPTION,
      inputSchema: isChatGptApp ? getChatGptAppDeepLinkInputSchema : getAppDeepLinkInputSchema,
      outputSchema: getAppDeepLinkOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: {
        securitySchemes: [{ type: "noauth" }],
      },
    },
    (args) => {
      // Defense in depth: even if a host invents a commerce action string, never
      // mint a purchase URL from the ChatGPT Apps endpoint.
      if (isChatGptApp && getIsMcpCommerceDeepLinkAction({ action: args.action })) {
        return errorResult(CHATGPT_APP_COMMERCE_DEEP_LINK_REJECTED_MESSAGE);
      }

      if (
        isChatGptApp &&
        args.action === "NAVIGATE" &&
        args.destination != null &&
        getIsChatGptForbiddenNavigateDestination({ destination: args.destination })
      ) {
        return errorResult(CHATGPT_APP_COMMERCE_DEEP_LINK_REJECTED_MESSAGE);
      }

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
