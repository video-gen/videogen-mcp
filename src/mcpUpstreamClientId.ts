/**
 * `X-VideoGen-Client` values the hosted MCP server may stamp on upstream API
 * calls. Keep aligned with the MCP-host entries in
 * `base/src/logic/integration/videoGenClientId.ts` (`VIDEOGEN_CLIENT_IDS`).
 * This package cannot import `@videogen/base`, so the list is duplicated here.
 */
export const MCP_UPSTREAM_CLIENT_IDS = [
  "amazon-q",
  "chatgpt",
  "claude",
  "claude-code",
  "cline",
  "codex",
  "continue",
  "copilot-studio",
  "cursor",
  "gemini",
  "goose",
  "jetbrains",
  "lm-studio",
  "mcp",
  "raycast",
  "vs-code",
  "warp",
  "windsurf",
  "zed",
] as const;

export type McpUpstreamClientId = (typeof MCP_UPSTREAM_CLIENT_IDS)[number];

/**
 * Parses a raw client id from a header or `vg_client` query param.
 * Returns `null` for missing, blank, or unknown values (callers must ignore
 * unknowns and fall back; never throw).
 */
export const getMcpUpstreamClientId = ({
  raw,
}: {
  raw: string | null | undefined;
}): McpUpstreamClientId | null => {
  if (raw == null) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  for (const knownClientId of MCP_UPSTREAM_CLIENT_IDS) {
    if (knownClientId === normalized) {
      return knownClientId;
    }
  }

  return null;
};
