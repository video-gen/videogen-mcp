import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetVideoGenClient } from "./client";
import { type McpOAuthContext, HOSTED_PROXY_SAFE_MAX_WAIT_MS, createMcpOperations } from "./operations";
import { registerTools } from "./registerTools";

export const SERVER_NAME = "videogen";
export const SERVER_VERSION = "0.0.1";

/**
 * OAuth scopes advertised for the hosted server: in each tool's `securitySchemes`
 * (SEP-1488) and in `scopes_supported` on the protected-resource metadata.
 *
 * These are the standard OIDC scopes the authorization server actually issues.
 * It does not yet support custom (e.g. `videogen:read`) scopes, and every issued
 * access token grants full access on the user's behalf, so advertising custom
 * scopes would be misleading and could make clients request scopes the
 * authorization server rejects. Revisit when the authorization server ships
 * granular scopes.
 */
export const OAUTH_SCOPES = ["email", "profile"] as const;

/**
 * Wraps `server.registerTool` so every tool advertises the OAuth security scheme
 * (SEP-1488) via its `_meta.securitySchemes`. MCP hosts (e.g. ChatGPT) require
 * this metadata — together with the `_meta["mcp/www_authenticate"]` challenge on
 * `401`s — to show a tool's OAuth linking UI. Applied only when the server
 * authenticates with OAuth; API-key servers advertise no scheme.
 *
 * Tools that set `_meta.securitySchemes` themselves (e.g. `open_uploader`'s
 * `{ type: "noauth" }`) keep that declaration — the patch only fills in the
 * default `oauth2` scheme when none was provided.
 *
 * `_meta` is where we CAN set it: the SDK's `tools/list` serializer emits `_meta`
 * verbatim but drops any unknown top-level field, so we cannot put
 * `securitySchemes` at the tool's top level here. The hosted HTTP transport
 * mirrors this `_meta.securitySchemes` up to the top level of each descriptor on
 * the way out — the location OpenAI's Apps SDK reads — see
 * `mirrorSecuritySchemesToTopLevel` in `http.ts`.
 */
function advertiseOAuthSecuritySchemes(server: McpServer, scopes: readonly string[]): void {
  const securitySchemes = [{ type: "oauth2", scopes: [...scopes] }];
  const originalRegisterTool = server.registerTool.bind(server);

  server.registerTool = (name, config, cb) => {
    // Preserve an explicit per-tool scheme (e.g. open_uploader → noauth).
    if (config._meta?.securitySchemes == null) {
      config._meta = { ...config._meta, securitySchemes };
    }

    return originalRegisterTool(name, config, cb);
  };
}

/**
 * Trust context the server runs in. `LOCAL` is the stdio subprocess on the
 * user's own machine (their filesystem, their key); `HOSTED` is the shared
 * multi-tenant cloud server. Tools that touch the host environment (e.g. local
 * filesystem reads) are only safe in `LOCAL` and must be withheld in `HOSTED`.
 */
export type McpExecutionMode = "LOCAL" | "HOSTED";

/**
 * Builds a fully-configured MCP server bound to a VideoGen client factory. Both
 * the local stdio entrypoint and the remote HTTP entrypoint use this. The tool
 * surface is nearly identical across transports; `executionMode` gates the few
 * tools that are only safe when the server runs on the caller's own machine. The
 * HTTP server builds a fresh instance per request because each request
 * authenticates as a different team.
 *
 * `getClient` is called only when a tool actually performs an API call — never
 * during discovery — so the SDK client (and its mandatory key) is constructed
 * lazily. This is what lets the OAuth server serve anonymous `tools/list`
 * without any credential.
 *
 * `hasCredentials` is whether the caller presented a bearer token. On an
 * OAuth-enabled server, discovery (`initialize` / `tools/list`) is served
 * unauthenticated so hosts can enumerate tools. On `/mcp/chatgpt`, a tool
 * invocation without credentials short-circuits to the OAuth sign-in challenge
 * on the tool result (see `createMcpOperations`) before `getClient` is ever
 * called. On the default `/mcp` path, protected tools are gated with HTTP 401
 * in `http.ts` instead. Stdio always carries a key, so it passes `true`.
 */
export function buildMcpServer(
  getClient: GetVideoGenClient,
  executionMode: McpExecutionMode,
  oauthContext: McpOAuthContext | null,
  abortSignal: AbortSignal | null,
  hasCredentials: boolean,
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  if (oauthContext != null) {
    advertiseOAuthSecuritySchemes(server, oauthContext.scopes);
  }

  registerTools(
    server,
    getClient,
    executionMode,
    createMcpOperations(
      oauthContext,
      abortSignal,
      hasCredentials,
      executionMode === "HOSTED" ? HOSTED_PROXY_SAFE_MAX_WAIT_MS : null,
    ),
  );

  return server;
}
