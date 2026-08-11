import { VideoGen } from "@videogen/sdk";
import type { VideoGenEnv } from "./env";
import type { McpUpstreamClientId } from "./mcpUpstreamClientId";

/**
 * Lazily produces the VideoGen SDK client. Constructing the client requires a
 * credential (the SDK constructor rejects an empty/absent key), so we defer
 * construction to the moment a tool actually performs an API call rather than
 * building it up front. On the hosted ChatGPT endpoint, anonymous discovery
 * never invokes a tool handler and therefore never calls this, so it needs no
 * credential or placeholder key. The standard endpoint requires a bearer
 * before discovery.
 */
export type GetVideoGenClient = () => VideoGen;

/**
 * Builds a VideoGen SDK client from a raw bearer credential.
 *
 * `bearerToken` is intentionally NOT called `apiKey`: it is whatever
 * `Authorization: Bearer <...>` value the caller presented. For stdio (and any
 * API-key caller) that is an `sk_videogen_live_...` key, but for an OAuth-linked
 * host (e.g. ChatGPT) it is an OAuth 2.1 access token — never a key. The upstream
 * developer API accepts either and classifies it (`resolveDeveloperApiCredential`
 * → `API_KEY | OAUTH`), so the SDK just forwards it verbatim as the bearer.
 *
 * The published `@videogen/sdk` deliberately keeps the option named `apiKey`
 * (matches its docs and the Stripe/OpenAI convention, since almost every direct
 * SDK caller passes a key); we map our neutral `bearerToken` onto it here.
 */
export function createVideoGenClientFromToken({
  bearerToken,
  baseUrl,
  clientId = "mcp",
}: {
  bearerToken: string;
  baseUrl: string;
  // Stamp the `X-VideoGen-Client` header so usage attribution and auto-detected
  // integrations can tell Cursor (`cursor`), Raycast (`raycast`), ChatGPT
  // (`chatgpt`), etc. apart from the generic MCP host (`mcp`).
  clientId?: McpUpstreamClientId;
}): VideoGen {
  return new VideoGen({ apiKey: bearerToken, baseUrl, clientId });
}

export function createVideoGenClient(env: VideoGenEnv): VideoGen {
  return createVideoGenClientFromToken({ bearerToken: env.apiKey, baseUrl: env.baseUrl });
}
