import type { Server } from "node:http";

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Keep-alive timeout for the remote MCP server, which runs on Google Cloud Run
 * behind Cloudflare + Google's front end / GFE. Every proxy in front of us keeps
 * a pool of persistent upstream connections open far longer than Node's 5s
 * default `keepAliveTimeout` and reuses them for later requests. If Node closes
 * an idle keep-alive socket (at 5s) in the same instant the proxy picks that
 * socket for the next request, the request lands on a socket Node is tearing
 * down, Node RSTs it, and the client sees an intermittent "unexpectedly closed
 * the connection" that succeeds on retry.
 *
 * The fix is to make the *proxy*, never Node, decide when to close a pooled
 * connection: 620s clears Google's ~600s front-end idle ceiling with margin.
 *
 * This mirrors `applyServerProxyKeepAliveTimeouts` in `@videogen/base`, but is
 * duplicated here because this package is published standalone to npm and must
 * not depend on internal `@videogen/*` workspace packages.
 */
const PROXY_SAFE_KEEP_ALIVE_TIMEOUT_MS = 620 * MILLISECONDS_PER_SECOND;

/**
 * Must be strictly greater than {@link PROXY_SAFE_KEEP_ALIVE_TIMEOUT_MS}: Node
 * requires `headersTimeout > keepAliveTimeout`, otherwise an in-flight request
 * on a reused keep-alive connection can be aborted. One extra second is enough.
 */
const PROXY_SAFE_HEADERS_TIMEOUT_MS = PROXY_SAFE_KEEP_ALIVE_TIMEOUT_MS + MILLISECONDS_PER_SECOND;

/**
 * Applies proxy-safe keep-alive / headers timeouts to the Node HTTP server so it
 * never closes a pooled connection before the upstream proxy does, avoiding the
 * intermittent "unexpectedly closed the connection" race described above.
 */
export function applyServerProxyKeepAliveTimeouts({ server }: { server: Server }): void {
  server.keepAliveTimeout = PROXY_SAFE_KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = PROXY_SAFE_HEADERS_TIMEOUT_MS;
}
