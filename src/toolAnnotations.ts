import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Explicit MCP tool annotations required for ChatGPT Apps / Plugins directory
 * submission. Every hosted tool sets all four hints explicitly for client
 * discovery and compatibility checks.
 *
 * Meanings (OpenAI Apps SDK review):
 * - idempotentHint: repeating the same call adds no further environmental effect
 * - readOnlyHint: true only when the tool never mutates state
 * - openWorldHint: true when the tool accesses public/open-ended entities or
 *   arbitrary external destinations, including read-only imports from URLs.
 *   A bounded private account or catalog can use false even when hosted remotely.
 * - destructiveHint: true when the tool can delete, detach, archive, cancel, or
 *   overwrite existing records (meaningful only when readOnlyHint is false).
 *   Creating a new file or project is not destructive.
 *
 * Tools confined to the caller's private VideoGen account use closed-world
 * annotations. Tools that also accept arbitrary public URLs use open-world hints.
 */

/** Fetches, lists, or computes without creating or updating records. */
export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
} as const satisfies ToolAnnotations;

/**
 * Creates a new private VideoGen file, project, upload, or export. Does not
 * delete, detach, archive, cancel, or overwrite an existing record.
 */
export const WRITE_PRIVATE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  idempotentHint: false,
  openWorldHint: false,
  destructiveHint: false,
} as const satisfies ToolAnnotations;

/** Creates private VideoGen output while importing from arbitrary public URLs. */
export const WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS = {
  ...WRITE_PRIVATE_TOOL_ANNOTATIONS,
  openWorldHint: true,
} satisfies ToolAnnotations;

/**
 * Deletes, detaches, archives, cancels, or overwrites existing private
 * VideoGen state. In-place remix and entity name updates belong here because
 * ChatGPT treats overwrite as destructive.
 */
export const DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  idempotentHint: false,
  openWorldHint: false,
  destructiveHint: true,
} as const satisfies ToolAnnotations;

/**
 * Repeating cancellation, archive, or detachment adds no further state change.
 * Archive/detach retries can report a missing record after the first success.
 */
export const IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS = {
  ...DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  idempotentHint: true,
} satisfies ToolAnnotations;
