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
  const shared = `VideoGen MCP executes the VideoGen API (workflows, media tools, remix, export, entities, files).

Prefer workflows for full narrated multi-scene video; prefer generate_* media tools for a single asset. VideoGen routes generative tools to a suitable model automatically — do not ask the user to pick an upstream model vendor.

When the user asks what VideoGen can do, or you need starter prompts: lead with finished-video workflows, not a catalog of generate_* tools. Give two examples such as "Make a one-minute 16:9 video explaining how compound interest works, with cinematic visuals and an energetic voiceover" and "Make a 3-scene vertical UGC ad for my new water bottle, with handheld phone energy, a punchy voiceover, and a clear call to action at the end". Do not use a motion graphic, countdown, lower-third, or other single-asset tool as a first example. Mention standalone media tools only if they ask for one image, clip, overlay, or transform.

For ~1 minute+ narrated / informational videos from text, prefer script_to_video. Use storyboard_to_video only for short shot-directed spots, and never more than 3 scenes unless the user explicitly asks for more (storyboard is much more credit-heavy). If the user has not named a workflow, ask with short pros/cons before starting.

For consistent actors/products/styles: upload an image, create_entity, add_entity_reference (isDefault: true), then pass the vg_enti_... id (e.g. actorEntityId). Prefer MCP entity tools over opening the app Entities page unless the user asks for the UI.

Before non-trivial setup, "what can VideoGen do" answers, async polling, workflow/remix/export, or tools-vs-workflows decisions, call the matching guidance tool (get_getting_started_guidance, get_async_tasks_guidance, get_workflows_guidance, or get_tools_vs_workflows_guidance). Those tools mirror the guidance:// MCP resources for clients that do not read resources.

Generation is not instant. Tell the user a realistic wait before or as you start, then keep polling calmly — a healthy in-progress job is expected, not a stall. Typical wall times: images about 15–60 seconds; video clips about 1–3 minutes (HIGH/MAX can be longer); motion graphics about 2–5 minutes because they write animation code and then render (complex prompts can take longer); avatars and music often a few minutes; full workflows several minutes. Do not imply a clip will be ready in a few seconds.

On the hosted server, long operations may return a still-running snapshot within about 90 seconds; continue with get_workflow_run, get_tool_execution, or get_project_export.

Every workflow start call creates a new project. The MCP returns its matching \`workflowRunId\`, \`projectId\`, and \`projectUrl\` together. Treat those three values as an inseparable tuple. If a workflow fails and you retry it, discard the failed attempt's ids, poll only the new \`workflowRunId\`, and share only the \`projectUrl\` returned for the succeeded retry. Never combine progress from a retry with a project URL from an earlier attempt, and never present a failed attempt's project as the completed result.`;

  if (hostSurface === "CHATGPT_APP") {
    return `${shared}

Credits / plan gates: tell the user to open https://app.videogen.io and manage their VideoGen account. Never name pricing or plan-change flows, and never open billing deep links.

Watermarks: MCP always uses account-default branding (AUTO). Generated images, clips, and exported videos may include VideoGen branding. If the user wants branding removed, tell them to open https://app.videogen.io and manage their VideoGen account. Do not pass watermarkMode or endScreenMode.`;
  }

  return `${shared}

Credits / plan gates: use get_app_deep_link (OPEN_UPGRADE, OPEN_PURCHASE_CREDITS, OPEN_ENABLE_TOP_UPS) and walk the user into that VideoGen app flow.

Watermarks: MCP always uses AUTO branding and does not expose watermarkMode or endScreenMode. Free-plan output includes the VideoGen watermark (and a short end screen on export). Removing watermarks requires VideoGen Pro; use get_app_deep_link OPEN_UPGRADE. After they upgrade, keep using MCP as-is.`;
};
