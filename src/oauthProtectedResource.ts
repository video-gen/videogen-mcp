import { OAUTH_SCOPES } from "./buildServer";

/**
 * Default MCP endpoint for hosts that start OAuth from the initial
 * transport-level HTTP 401 challenge.
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

/**
 * RFC 8414 Authorization Server Metadata at the pathless issuer we advertise for
 * Cursor / Claude on `/mcp`. Cursor strips path components from
 * `authorization_servers` (it does not follow RFC 8414 §3 for path issuers), so
 * a Supabase issuer like `https://….supabase.co/auth/v1` becomes
 * `https://….supabase.co` and AS rediscovery 404s. Advertising `{origin}` and
 * serving metadata here keeps Cursor on a discoverable, pathless issuer while
 * the authorize / token / register endpoints still point at Supabase Auth.
 */
export const OAUTH_AUTHORIZATION_SERVER_METADATA_PATH =
  "/.well-known/oauth-authorization-server";

/**
 * OpenAI Plugins / ChatGPT Apps domain-verification challenge (RFC 8615).
 * OpenAI always GETs this origin-root path; Challenge Base URL path suffixes
 * are ignored. Body must be the portal token as `text/plain`, nothing else.
 */
export const OPENAI_APPS_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

/** Same document under the OpenID discovery well-known path some hosts try first. */
export const OPENID_CONFIGURATION_PATH = "/.well-known/openid-configuration";

/** How a hosted MCP path challenges credential-less protected tool calls. */
export type McpAuthChallengeMode = "HTTP_401" | "TOOL_RESULT";

/**
 * Builds the OAuth 2.0 Protected Resource Metadata (RFC 9728) document that MCP
 * clients fetch to discover which authorization server issues tokens for this
 * resource. Returns null when no OAuth issuer is configured (API-key-only mode).
 *
 * Authorization server selection by resource path:
 * - Default `/mcp` (Cursor / Claude): pathless `{origin}` — see
 *   `OAUTH_AUTHORIZATION_SERVER_METADATA_PATH`.
 * - `/mcp/chatgpt`: the real Supabase Auth issuer (`…/auth/v1`). ChatGPT follows
 *   RFC 8414 path-aware discovery and must keep issuing against the token `iss`.
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

  const authorizationServers =
    resourcePath === MCP_CHATGPT_PATH ? [oauthIssuer] : [origin];

  return {
    resource: `${origin}${resourcePath}`,
    authorization_servers: authorizationServers,
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://docs.videogen.io/libraries/mcp",
  };
}

/**
 * Builds Authorization Server Metadata (RFC 8414) for the pathless MCP origin
 * issuer. Authorize / token / register / JWKS stay on the real Supabase Auth
 * issuer so minted access tokens keep validating upstream via `getClaims`.
 *
 * `issuer` is the pathless MCP origin (not Supabase). That mismatches the JWT
 * `iss` claim (`…/auth/v1`); hosts that strictly require `token.iss ===
 * metadata.issuer` would reject these tokens. Cursor does not, and our
 * developer API validates signature + `client_id` rather than PRM issuer match.
 */
export function buildAuthorizationServerMetadata({
  origin,
  oauthIssuer,
}: {
  origin: string;
  oauthIssuer: string;
}): Record<string, unknown> {
  return {
    issuer: origin,
    authorization_endpoint: `${oauthIssuer}/oauth/authorize`,
    token_endpoint: `${oauthIssuer}/oauth/token`,
    jwks_uri: `${oauthIssuer}/.well-known/jwks.json`,
    userinfo_endpoint: `${oauthIssuer}/oauth/userinfo`,
    registration_endpoint: `${oauthIssuer}/oauth/clients/register`,
    scopes_supported: ["openid", "profile", "email", "phone", "offline_access"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256", "HS256", "ES256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    code_challenge_methods_supported: ["S256", "plain"],
    claims_supported: [
      "sub",
      "aud",
      "iss",
      "exp",
      "iat",
      "auth_time",
      "nonce",
      "email",
      "email_verified",
      "phone_number",
      "phone_number_verified",
      "name",
      "picture",
      "preferred_username",
      "updated_at",
    ],
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
 */
export function buildWwwAuthenticateChallenge({
  origin,
  oauthIssuer,
  resourcePath = MCP_PATH,
}: {
  origin: string;
  oauthIssuer: string | null;
  resourcePath?: string;
}): string {
  if (oauthIssuer == null) {
    return 'Bearer realm="VideoGen MCP"';
  }

  const resourceMetadataUrl = buildResourceMetadataUrl({ origin, resourcePath });
  return `Bearer realm="VideoGen MCP", resource_metadata="${resourceMetadataUrl}"`;
}
