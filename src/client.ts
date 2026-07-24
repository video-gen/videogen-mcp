import { VideoGen } from "@videogen/sdk";
import type { VideoGenEnv } from "./env";

/**
 * Lazily produces the VideoGen SDK client. Constructing the client requires a
 * credential (the SDK constructor rejects an empty/absent key), so we defer
 * construction to the moment a tool actually performs an API call rather than
 * building it up front. On the hosted OAuth server, anonymous discovery
 * (`initialize` / `tools/list`) never invokes a tool handler and therefore never
 * calls this — so it needs no credential and no placeholder key.
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
}: {
  bearerToken: string;
  baseUrl: string;
}): VideoGen {
  return new VideoGen({ apiKey: bearerToken, baseUrl, clientId: "mcp" });
}

export function createVideoGenClient(env: VideoGenEnv): VideoGen {
  return createVideoGenClientFromToken({ bearerToken: env.apiKey, baseUrl: env.baseUrl });
}
