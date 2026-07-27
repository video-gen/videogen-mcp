import { OAUTH_SCOPES } from "./buildServer";

export const MCP_PATH = "/mcp";
export const OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

/**
 * RFC 9728 §3.1 path-aware discovery URL: when the resource identifier ends in
 * `/mcp`, clients insert that path after the well-known segment.
 */
export const OAUTH_PROTECTED_RESOURCE_MCP_PATH = `${OAUTH_PROTECTED_RESOURCE_PATH}${MCP_PATH}`;

/**
 * Builds the OAuth 2.0 Protected Resource Metadata (RFC 9728) document that MCP
 * clients fetch to discover which authorization server issues tokens for this
 * resource. Returns null when no OAuth issuer is configured (API-key-only mode).
 */
export function buildProtectedResourceMetadata({
  origin,
  oauthIssuer,
}: {
  origin: string;
  oauthIssuer: string | null;
}): Record<string, unknown> | null {
  if (oauthIssuer == null) {
    return null;
  }

  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [oauthIssuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://docs.videogen.io/libraries/mcp",
  };
}

/**
 * Builds the `WWW-Authenticate` challenge for an unauthenticated request. When
 * an OAuth issuer is configured, it points clients at this resource's protected
 * resource metadata (per the MCP authorization spec) so they can bootstrap the
 * OAuth flow; otherwise it falls back to a plain Bearer realm.
 */
export function buildWwwAuthenticateChallenge({
  origin,
  oauthIssuer,
}: {
  origin: string;
  oauthIssuer: string | null;
}): string {
  if (oauthIssuer == null) {
    return 'Bearer realm="VideoGen MCP"';
  }

  const resourceMetadataUrl = `${origin}${OAUTH_PROTECTED_RESOURCE_PATH}`;

  return `Bearer realm="VideoGen MCP", resource_metadata="${resourceMetadataUrl}"`;
}
