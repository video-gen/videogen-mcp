import { getServerInstructionsForHostSurface } from "../hostSurface";

/**
 * Short initialize instructions so hosts that surface server instructions nudge
 * agents toward the guidance tools before non-trivial VideoGen work.
 *
 * This is the STANDARD (`/mcp`, stdio) default. ChatGPT Apps use
 * `getServerInstructionsForHostSurface({ hostSurface: "CHATGPT_APP" })` via
 * `buildMcpServer` so credits copy never directs users to purchase digital goods.
 */
export const SERVER_INSTRUCTIONS = getServerInstructionsForHostSurface({
  hostSurface: "STANDARD",
});
