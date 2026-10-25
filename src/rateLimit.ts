import { getIsCloudflareIp } from "./cloudflareIp";

const WINDOW_MS = 60_000;

const MAX_TRACKED_BUCKETS = 50_000;

export const MCP_ANONYMOUS_DISCOVERY_LIMIT_PER_MINUTE = 60;

export const MCP_ANONYMOUS_NOAUTH_TOOL_LIMIT_PER_MINUTE = 30;

export const MCP_METADATA_LIMIT_PER_MINUTE = 120;

// Map iteration order is insertion order and every consume re-inserts its key,
// so the first key is always the least recently used bucket.
const buckets = new Map<string, number[]>();

let lastSweepAtMs = 0;

const sweepExpiredBuckets = ({ windowStartMs }: { windowStartMs: number }): void => {
  for (const [key, timestamps] of buckets) {
    const latestTimestampMs = timestamps[timestamps.length - 1];

    if (latestTimestampMs == null || latestTimestampMs <= windowStartMs) {
      buckets.delete(key);
    }
  }
};

const evictLeastRecentlyUsedBuckets = (): void => {
  for (const key of buckets.keys()) {
    if (buckets.size <= MAX_TRACKED_BUCKETS) {
      return;
    }

    buckets.delete(key);
  }
};

export const consumeRateLimit = ({
  key,
  limit,
  nowMs,
}: {
  key: string;
  limit: number;
  nowMs: number;
}): boolean => {
  const windowStart = nowMs - WINDOW_MS;

  if (nowMs - lastSweepAtMs >= WINDOW_MS) {
    lastSweepAtMs = nowMs;
    sweepExpiredBuckets({ windowStartMs: windowStart });
  }

  const prior = buckets.get(key) ?? [];
  const recent = prior.filter((timestampMs) => timestampMs > windowStart);
  const allowed = recent.length < limit;

  if (allowed) {
    recent.push(nowMs);
  }

  buckets.delete(key);
  buckets.set(key, recent);
  evictLeastRecentlyUsedBuckets();

  return allowed;
};

/**
 * Hostname from a request `Host` header, or null when it is missing or not a host.
 * `URL` strips any port. The header is not fetched.
 */
const getRequestHostname = (hostHeader: string | undefined): string | null => {
  if (hostHeader == null || hostHeader.trim() === "") {
    return null;
  }

  try {
    return new URL(`http://${hostHeader.trim()}`).hostname;
  } catch {
    return null;
  }
};

/**
 * Resolves the caller's IP for rate limiting.
 *
 * `X-Forwarded-For` is client-controlled except for the entries our own proxies
 * append on the right. Only the entry `trustedProxyHopCount` positions from the
 * right is trusted (Cloud Run's front end appends the connecting peer as the
 * last entry). A trusted Cloudflare address is stepped over only when the
 * request `Host` is `cloudflareEdgeHost` — the public hostname of this
 * deployment. That is the request that passed through our zone, which appends
 * the real client just left of its edge. A direct `*.run.app` call, including
 * one that comes from a Cloudflare Worker and supplies its own
 * `X-Forwarded-For`, is keyed on the connecting peer. With zero trusted hops,
 * or when the header is shorter than the trusted chain, the socket peer
 * address is used.
 */
export const getClientIp = ({
  forwardedFor,
  socketAddress,
  trustedProxyHopCount,
  trustCloudflareEdgeHop,
  host,
  cloudflareEdgeHost,
}: {
  forwardedFor: string | string[] | undefined;
  socketAddress: string | undefined;
  trustedProxyHopCount: number;
  trustCloudflareEdgeHop: boolean;
  host: string | undefined;
  cloudflareEdgeHost: string | null;
}): string => {
  if (forwardedFor != null && trustedProxyHopCount > 0) {
    const hops = (Array.isArray(forwardedFor) ? forwardedFor : [forwardedFor])
      .flatMap((headerValue) => headerValue.split(","))
      .map((hop) => hop.trim())
      .filter((hop) => hop !== "");

    const trustedHopIndex = hops.length - trustedProxyHopCount;
    const trustedHop = hops[trustedHopIndex];

    if (trustedHop != null) {
      const requestHostname = getRequestHostname(host);
      const edgeHostname = cloudflareEdgeHost?.trim().toLowerCase() ?? "";

      if (
        trustCloudflareEdgeHop &&
        edgeHostname !== "" &&
        requestHostname === edgeHostname &&
        getIsCloudflareIp(trustedHop)
      ) {
        return hops[trustedHopIndex - 1] ?? trustedHop;
      }

      return trustedHop;
    }
  }

  if (socketAddress != null && socketAddress !== "") {
    return socketAddress;
  }

  return "unknown";
};
