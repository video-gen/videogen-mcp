const WINDOW_MS = 60_000;

export const MCP_ANONYMOUS_DISCOVERY_LIMIT_PER_MINUTE = 60;

export const MCP_ANONYMOUS_NOAUTH_TOOL_LIMIT_PER_MINUTE = 30;

export const MCP_METADATA_LIMIT_PER_MINUTE = 120;

const buckets = new Map<string, number[]>();

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
  const prior = buckets.get(key) ?? [];
  const recent = prior.filter((timestampMs) => timestampMs > windowStart);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }

  recent.push(nowMs);
  buckets.set(key, recent);
  return true;
};

export const getClientIp = ({
  forwardedFor,
  socketAddress,
}: {
  forwardedFor: string | string[] | undefined;
  socketAddress: string | undefined;
}): string => {
  if (forwardedFor != null) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

    if (raw != null && raw !== "") {
      const firstHop = raw.split(",")[0]?.trim();

      if (firstHop != null && firstHop !== "") {
        return firstHop;
      }
    }
  }

  if (socketAddress != null && socketAddress !== "") {
    return socketAddress;
  }

  return "unknown";
};
