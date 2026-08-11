import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Explicit MCP tool annotations required for ChatGPT Apps / Plugins directory
 * submission. Every hosted tool must set all three hints; missing values are a
 * submission blocker.
 *
 * Meanings (OpenAI Apps SDK review):
 * - readOnlyHint: true only when the tool never mutates state
 * - openWorldHint: true only when the tool can change publicly visible internet
 *   state or third-party systems outside the user's private VideoGen account
 * - destructiveHint: true when the tool can cancel/abort irreversible in-flight
 *   work or otherwise destroy state (meaningful only when readOnlyHint is false)
 *
 * All VideoGen tools operate inside the caller's private VideoGen account, so
 * openWorldHint is false across the surface.
 */

/** Fetches, lists, or computes without creating or updating records. */
export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
} as const satisfies ToolAnnotations;

/**
 * Creates or updates private VideoGen resources (workflows, media, uploads,
 * exports, remix) without deleting or irreversibly aborting work.
 */
export const WRITE_PRIVATE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
} as const satisfies ToolAnnotations;

/** Cancels in-flight work that cannot be resumed as the same run. */
export const DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: true,
} as const satisfies ToolAnnotations;
