import { OAUTH_SCOPES } from "./buildServer";

/**
 * Default MCP endpoint (Cursor, Claude, VS Code, and other hosts that follow
 * transport-level HTTP 401 lazy auth).
 */
export const MCP_PATH = "/mcp";

/**
 * ChatGPT Apps endpoint. ChatGPT does not re-trigger OAuth from a transport
 * `401` on `tools/call`; it needs a tool-result `_meta["mcp/www_authenticate"]`
 * challenge instead. Keep that soft-challenge mode off the default path so
 * Cursor / Claude stay standards-compliant.
 */
export const MCP_CHATGPT_PATH = "/mcp/chatgpt";

export const OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

/**
 * RFC 9728 §3.1 path-aware discovery URL for the default `/mcp` resource.
 */
export const OAUTH_PROTECTED_RESOURCE_MCP_PATH = `${OAUTH_PROTECTED_RESOURCE_PATH}${MCP_PATH}`;

/**
 * RFC 9728 §3.1 path-aware discovery URL for the ChatGPT `/mcp/chatgpt` resource.
 */
export const OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH = `${OAUTH_PROTECTED_RESOURCE_PATH}${MCP_CHATGPT_PATH}`;

/** How a hosted MCP path challenges credential-less protected tool calls. */
export type McpAuthChallengeMode = "HTTP_401" | "TOOL_RESULT";

/**
 * Builds the OAuth 2.0 Protected Resource Metadata (RFC 9728) document that MCP
 * clients fetch to discover which authorization server issues tokens for this
 * resource. Returns null when no OAuth issuer is configured (API-key-only mode).
 */
export function buildProtectedResourceMetadata({
  origin,
  oauthIssuer,
  resourcePath = MCP_PATH,
}: {
  origin: string;
  oauthIssuer: string | null;
  resourcePath?: string;
}): Record<string, unknown> | null {
  if (oauthIssuer == null) {
    return null;
  }

  return {
    resource: `${origin}${resourcePath}`,
    authorization_servers: [oauthIssuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://docs.videogen.io/libraries/mcp",
  };
}

/**
 * Path-aware protected-resource metadata URL for a given MCP resource path
 * (RFC 9728 §3.1).
 */
export function buildResourceMetadataUrl({
  origin,
  resourcePath,
}: {
  origin: string;
  resourcePath: string;
}): string {
  return `${origin}${OAUTH_PROTECTED_RESOURCE_PATH}${resourcePath}`;
}

/**
 * Builds the `WWW-Authenticate` challenge for an unauthenticated request. When
 * an OAuth issuer is configured, it points clients at this resource's protected
 * resource metadata (per the MCP authorization spec) so they can bootstrap the
 * OAuth flow; otherwise it falls back to a plain Bearer realm.
 *
 * Pass `includeInvalidToken: true` for protected `tools/call` lazy-auth gates
 * (Cursor / Claude): those hosts key off `error` + `error_description` on the
 * transport challenge.
 */
export function buildWwwAuthenticateChallenge({
  origin,
  oauthIssuer,
  resourcePath = MCP_PATH,
  includeInvalidToken = false,
}: {
  origin: string;
  oauthIssuer: string | null;
  resourcePath?: string;
  includeInvalidToken?: boolean;
}): string {
  if (oauthIssuer == null) {
    return 'Bearer realm="VideoGen MCP"';
  }

  const resourceMetadataUrl = buildResourceMetadataUrl({ origin, resourcePath });
  const params = [
    `realm="VideoGen MCP"`,
    `resource_metadata="${resourceMetadataUrl}"`,
  ];

  if (includeInvalidToken) {
    params.push(`error="invalid_token"`);
    params.push(`error_description="Sign in to VideoGen to continue"`);
    params.push(`scope="${OAUTH_SCOPES.join(" ")}"`);
  }

  return `Bearer ${params.join(", ")}`;
}
