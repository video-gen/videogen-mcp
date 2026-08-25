const DEFAULT_BASE_URL = "https://api.videogen.io";

const VIDEOGEN_ENVIRONMENTS = [
  "LOCAL",
  "DEV",
  "STAGING",
  "PRERELEASE",
  "PROD",
] as const;

export type VideogenEnvironment = (typeof VIDEOGEN_ENVIRONMENTS)[number];

const HOSTED_VIDEOGEN_ENVIRONMENTS = [
  "DEV",
  "STAGING",
  "PRERELEASE",
  "PROD",
] as const satisfies readonly VideogenEnvironment[];

/**
 * The environment this container was built for, injected as `VIDEOGEN_ENV` at
 * build time (see ci-cd/docker/mcp/Dockerfile). Anything unrecognized — most
 * notably an external self-hosted run where the var is unset — resolves to
 * `LOCAL`.
 */
export function getVideogenEnvironment(): VideogenEnvironment {
  const rawEnv = process.env.VIDEOGEN_ENV;

  return VIDEOGEN_ENVIRONMENTS.find((env) => env === rawEnv) ?? "LOCAL";
}

export type VideoGenEnv = {
  apiKey: string;
  baseUrl: string;
};

export type ReadEnvResult = { ok: true; env: VideoGenEnv } | { ok: false; message: string };

/**
 * Reads configuration from the environment. The API key is required; every tool
 * call is authenticated as the team that owns the key. `VIDEOGEN_BASE_URL` lets
 * the server point at a non-production stack (e.g. http://localhost:4010).
 */
export function readEnv(): ReadEnvResult {
  const apiKey = process.env.VIDEOGEN_API_KEY;

  if (apiKey == null || apiKey.trim() === "") {
    return {
      ok: false,
      message:
        "VIDEOGEN_API_KEY is not set. Create a key at https://app.videogen.io/api and pass it to the MCP server via the VIDEOGEN_API_KEY environment variable.",
    };
  }

  return { ok: true, env: { apiKey: apiKey.trim(), baseUrl: readBaseUrl() } };
}

const DEFAULT_PORT = 8080;

export type HttpServerConfig = {
  port: number;
  baseUrl: string;
  /**
   * The OAuth 2.1 authorization server (issuer) that mints access tokens for
   * this MCP resource server. When set, the server advertises OAuth protected
   * resource metadata (RFC 9728) and a richer `WWW-Authenticate` challenge so
   * MCP clients (ChatGPT, Claude) can discover the auth server and run the
   * account-linking flow. When unset, the server keeps its API-key-only
   * behavior and does not advertise OAuth.
   */
  oauthIssuer: string | null;
  /**
   * The trusted public origin (scheme + host, e.g. `https://mcp.videogen.io`)
   * this server is reached on. When set, it is the ONLY source used to build
   * OAuth metadata / `WWW-Authenticate` resource URLs — the client-controlled
   * `Host` / `X-Forwarded-Host` headers are ignored, preventing metadata
   * poisoning. When unset (local dev, where no attacker sits in front of us),
   * the server falls back to reconstructing the origin from the request.
   */
  publicOrigin: string | null;
  /**
   * Public OpenAI Plugins / ChatGPT Apps domain-verification token. When set,
   * GET `/.well-known/openai-apps-challenge` returns this exact value as
   * `text/plain` so the portal can verify `mcp.videogen.io`. This is a public
   * challenge token, not a credential. Empty or unset → that route 404s with a
   * non-JSON-RPC body.
   */
  openaiAppsChallengeToken: string | null;
};

/**
 * Reads configuration for the remote (Streamable HTTP) transport. Unlike the
 * stdio transport, no API key lives in the environment — each HTTP request
 * carries its own `Authorization: Bearer <key>` header, so the server stays
 * multi-tenant. `PORT` is provided by Cloud Run (defaults to 8080).
 */
export function readHttpServerConfig(): HttpServerConfig {
  const rawPort = process.env.PORT;
  const parsedPort = rawPort != null ? Number.parseInt(rawPort, 10) : Number.NaN;
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

  return {
    port,
    baseUrl: readBaseUrl(),
    oauthIssuer: readOauthIssuer(),
    publicOrigin: readPublicOrigin(),
    openaiAppsChallengeToken: readOpenaiAppsChallengeToken(),
  };
}

/**
 * The public origin (scheme + host) this server is reached on, resolved by a
 * switch on the build-time environment — same pattern as every other VideoGen
 * URL getter. It is the trusted source for OAuth metadata / `WWW-Authenticate`
 * resource URLs, so client-controlled `Host` headers can't poison them.
 *
 * LOCAL returns null so the server reconstructs the origin from the request
 * (safe locally, where no proxy/attacker sits in front of us). Self-hosters
 * behind their own domain can override via `VIDEOGEN_MCP_PUBLIC_ORIGIN`.
 */
function readPublicOrigin(): string | null {
  const override = process.env.VIDEOGEN_MCP_PUBLIC_ORIGIN;

  if (override != null && override.trim() !== "") {
    // Normalize away any trailing slash so origin-derived URLs are built consistently.
    return override.trim().replace(/\/+$/, "");
  }

  switch (getVideogenEnvironment()) {
    case "PROD":
      return "https://mcp.videogen.io";
    case "PRERELEASE":
      return "https://prerelease.mcp.videogen.io";
    case "DEV":
      return "https://dev.mcp.videogen.io";
    case "STAGING":
      return "https://staging.mcp.videogen.io";
    case "LOCAL":
      return null;
  }
}

function readOpenaiAppsChallengeToken(): string | null {
  const rawToken = process.env.VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN;

  if (rawToken == null || rawToken.trim() === "") {
    return null;
  }

  return rawToken.trim();
}

/**
 * Resolves the OAuth 2.1 authorization server (issuer) that mints access tokens
 * for this MCP resource server. Mirrors the developer API's resolution order
 * (see api/src/config.ts) so the hosted MCP advertises the SAME issuer as the
 * upstream API it proxies to — a token minted for one authorization server would
 * not validate on the other, so they must agree.
 *
 * Resolution order:
 *   1. `VIDEOGEN_OAUTH_ISSUER` — explicit full issuer URL. Used for local dev
 *      and tests (e.g. `http://127.0.0.1:54321/auth/v1`).
 *   2. `VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL` — the Supabase project base URL
 *      injected at deploy time (from the existing SUPABASE_<env>_PROJECT_URL
 *      secret; see ci-cd/config.deploy.ts). Supabase Auth is the authorization
 *      server, so the issuer is `${projectUrl}/auth/v1`.
 *   3. Otherwise null — OAuth stays disabled (API-key-only).
 */
function readOauthIssuer(): string | null {
  const explicitIssuer = process.env.VIDEOGEN_OAUTH_ISSUER;

  if (explicitIssuer != null && explicitIssuer.trim() !== "") {
    // Normalize away any trailing slash so metadata URLs are built consistently.
    return explicitIssuer.trim().replace(/\/+$/, "");
  }

  const supabaseProjectUrl = process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL;

  if (supabaseProjectUrl != null && supabaseProjectUrl.trim() !== "") {
    return `${supabaseProjectUrl.trim().replace(/\/+$/, "")}/auth/v1`;
  }

  return null;
}

/**
 * The upstream VideoGen developer API this server proxies caller tokens to. An
 * explicit `VIDEOGEN_BASE_URL` always wins (local development, self-hosting).
 * Otherwise it is resolved by a switch on the build-time environment so each
 * hosted deployment talks to its OWN stack — the same per-env pattern as
 * `readPublicOrigin` above.
 *
 * This MUST stay in lockstep with the OAuth issuer (`readOauthIssuer`): the API
 * host resolved here validates OAuth access tokens against the issuer this server
 * advertises, so the dev MCP must reach the dev API (which trusts the dev
 * issuer), the prod MCP the prod API, and so on — otherwise a token this server
 * accepts would be rejected upstream.
 *
 * LOCAL (the published npm package, or any run where `VIDEOGEN_ENV` is unset)
 * falls back to the public prod API.
 */
const getDefaultBaseUrl = ({
  environment,
}: {
  environment: VideogenEnvironment;
}): string => {
  switch (environment) {
    case "PROD":
      return "https://api.videogen.io";
    case "PRERELEASE":
      return "https://prerelease.api.videogen.io";
    case "DEV":
      return "https://dev.api.videogen.io";
    case "STAGING":
      return "https://staging.api.videogen.io";
    case "LOCAL":
      return DEFAULT_BASE_URL;
  }
};

export function readBaseUrl(): string {
  const baseUrlOverride = process.env.VIDEOGEN_BASE_URL;

  if (baseUrlOverride != null && baseUrlOverride.trim() !== "") {
    return baseUrlOverride.trim();
  }

  return getDefaultBaseUrl({ environment: getVideogenEnvironment() });
}

/**
 * Resolves the app environment corresponding to an API base URL. This keeps
 * deep links on the same hosted stack as API traffic when `VIDEOGEN_ENV` is
 * absent, while preserving LOCAL for custom/self-hosted URLs.
 */
export function getVideogenEnvironmentForBaseUrl({
  baseUrl,
}: {
  baseUrl: string;
}): VideogenEnvironment {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  for (const environment of HOSTED_VIDEOGEN_ENVIRONMENTS) {
    if (normalizedBaseUrl === getDefaultBaseUrl({ environment })) {
      return environment;
    }
  }

  return getVideogenEnvironment();
}
