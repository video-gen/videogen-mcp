/**
 * Which public MCP host surface this server instance is serving.
 *
 * - `STANDARD`: `/mcp` (hosted) and stdio `@videogen/mcp`. Commerce deep links
 *   and direct upgrade / buy-credits / enable-top-ups guidance are allowed.
 * - `CHATGPT_APP`: `/mcp/chatgpt` only. OpenAI's Plugins directory forbids
 *   directing users to purchase digital goods (subscriptions, credits, IAPs).
 *   Commerce deep-link actions and NAVIGATE → BILLING_SETTINGS are omitted /
 *   rejected, and billing failures are rewritten to "manage your VideoGen
 *   account" copy that never says purchase / buy / upgrade / top-ups.
 *
 * See `.cursor/rules/chatgpt-mcp-no-commerce.mdc`.
 */
export type McpHostSurface = "STANDARD" | "CHATGPT_APP";

/** Deep-link actions that open VideoGen purchase / plan / pricing flows. */
export const MCP_COMMERCE_DEEP_LINK_ACTIONS = [
  "OPEN_UPGRADE",
  "OPEN_ENABLE_TOP_UPS",
  "OPEN_PURCHASE_CREDITS",
  "OPEN_RATE_CARD",
] as const;

export type McpCommerceDeepLinkAction = (typeof MCP_COMMERCE_DEEP_LINK_ACTIONS)[number];

const COMMERCE_DEEP_LINK_ACTION_SET: ReadonlySet<string> = new Set(MCP_COMMERCE_DEEP_LINK_ACTIONS);

export const getIsMcpCommerceDeepLinkAction = ({
  action,
}: {
  action: string;
}): boolean => COMMERCE_DEEP_LINK_ACTION_SET.has(action);

/**
 * `NAVIGATE` destinations that open billing / purchase UI. Forbidden on ChatGPT
 * even though `NAVIGATE` itself stays available for non-billing pages.
 */
export const MCP_CHATGPT_FORBIDDEN_NAVIGATE_DESTINATIONS = ["BILLING_SETTINGS"] as const;

const CHATGPT_FORBIDDEN_NAVIGATE_DESTINATION_SET: ReadonlySet<string> = new Set(
  MCP_CHATGPT_FORBIDDEN_NAVIGATE_DESTINATIONS,
);

export const getIsChatGptForbiddenNavigateDestination = ({
  destination,
}: {
  destination: string;
}): boolean => CHATGPT_FORBIDDEN_NAVIGATE_DESTINATION_SET.has(destination);

/**
 * ChatGPT Apps / Plugins: never name purchase flows. Point the user at the app
 * to manage their account; the need to fix credits / plan access is implied.
 */
export const CHATGPT_APP_ACCOUNT_GATE_MESSAGE =
  "You're out of credits, or this feature isn't available on your VideoGen account. Open https://app.videogen.io and manage your VideoGen account to enable it, then try again.";

export const CHATGPT_APP_COMMERCE_DEEP_LINK_REJECTED_MESSAGE =
  "That VideoGen account action isn't available through the ChatGPT app. Tell the user to open https://app.videogen.io and manage their VideoGen account, then retry.";

/**
 * Heuristic for API / SDK error text that is really a credits or plan gate.
 * Used only on `CHATGPT_APP` to rewrite commerce-flavored upstream copy.
 */
export const getLooksLikeMcpBillingGateMessage = ({
  message,
}: {
  message: string;
}): boolean => {
  const lower = message.toLowerCase();

  return (
    lower.includes("credit") ||
    lower.includes("upgrade") ||
    lower.includes("purchase") ||
    lower.includes("buy ") ||
    lower.includes("top-up") ||
    lower.includes("top up") ||
    lower.includes("topups") ||
    lower.includes("subscription") ||
    lower.includes("pro plan") ||
    lower.includes("refill")
  );
};

export const rewriteMcpErrorMessageForHostSurface = ({
  message,
  hostSurface,
}: {
  message: string;
  hostSurface: McpHostSurface;
}): string => {
  if (hostSurface !== "CHATGPT_APP") {
    return message;
  }

  if (!getLooksLikeMcpBillingGateMessage({ message })) {
    return message;
  }

  return CHATGPT_APP_ACCOUNT_GATE_MESSAGE;
};

export const STANDARD_MCP_CREDITS_GUIDANCE = `## Credits and product UI

Generation spends team credits. When a tool fails for credits or plan access, be direct: call \`get_app_deep_link\` with \`OPEN_UPGRADE\`, \`OPEN_PURCHASE_CREDITS\`, or \`OPEN_ENABLE_TOP_UPS\` as appropriate, return that URL, and walk the user into the flow in the VideoGen app. Do not claim MCP can change billing inline.

MCP never exposes \`watermarkMode\` or \`endScreenMode\`. Every generation and export uses \`AUTO\`: Free-plan results include the VideoGen watermark (and a short "Made with VideoGen" end screen on project exports). Removing that branding requires VideoGen Pro. If the user wants watermark-free output, call \`get_app_deep_link\` with \`OPEN_UPGRADE\` and walk them into Pro. After they upgrade, keep using MCP as-is; \`AUTO\` then omits branding. Do not invent those parameters or tell the user to change a workspace watermark setting.`;

export const CHATGPT_APP_CREDITS_GUIDANCE = `## Credits and account access

Generation spends team credits. If a tool fails because the user is out of credits or a feature isn't available on their account, say clearly that they need to open https://app.videogen.io and manage their VideoGen account to enable it, then retry.

Do not name pricing, plan changes, or credit refill flows. Do not call \`get_app_deep_link\` for billing actions (those actions are not available on this ChatGPT host).

MCP never exposes watermark or end-screen settings. Generated images, clips, and exported videos may include VideoGen branding depending on the account. If the user wants that branding removed, tell them to open https://app.videogen.io and manage their VideoGen account, then retry. Do not invent watermark parameters.`;

export const getServerInstructionsForHostSurface = ({
  hostSurface,
}: {
  hostSurface: McpHostSurface;
}): string => {
  const shared = `Before setup or capability answers, call get_getting_started_guidance. Before generation, call get_workflows_guidance or get_tools_vs_workflows_guidance; before polling, call get_async_tasks_guidance. These mirror guidance:// resources and contain workflow choices, examples, style prompts, entity references, and complete operating guidance.

VideoGen creates editable videos and standalone media. Prefer workflows for full videos and media tools for single assets. If no workflow was named, ask with brief pros/cons. Prefer script_to_video for longer narrated videos; keep storyboards to 3 scenes unless explicitly asked for more. Use full style prompts from get_workflows_guidance.

Generation spends team credits and takes time. Set honest expectations: images 15–60 seconds, clips 1–3 minutes, motion graphics 2–5 minutes, full workflows several minutes. Hosted calls may return running snapshots after 90 seconds; continue with get_workflow_run, get_tool_execution, or get_project_export. Never restart a healthy run to poll it.

Preserve the user's required inputs. If a request cannot use them together, explain the constraint and agree on a supported approach before dropping references or increasing paid quality. Reference-guided generation does not guarantee exact reproduction.

Each workflow start creates a new project. Keep workflowRunId, projectId, and projectUrl together; after a retry use only the new run's ids and URL. Share downloadUrl after success. For entity references, attach uploaded files with add_entity_reference and pass entity ids on the appropriate workflow and scene fields.

MCP uses AUTO account-default branding. Never invent watermarkMode or endScreenMode inputs.`;

  if (hostSurface === "CHATGPT_APP") {
    return `${shared}

For credits, plan access, or branding removal, tell the user to open https://app.videogen.io and manage their VideoGen account. Never name pricing or plan-change flows or open billing deep links.`;
  }

  return `${shared}

For credits or plan gates, use get_app_deep_link with OPEN_UPGRADE, OPEN_PURCHASE_CREDITS, or OPEN_ENABLE_TOP_UPS. Removing Free-plan branding requires VideoGen Pro (OPEN_UPGRADE).`;
};
