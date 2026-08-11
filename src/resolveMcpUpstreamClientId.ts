import {
  type McpUpstreamClientId,
  getMcpUpstreamClientId,
} from "./mcpUpstreamClientId";

/**
 * Resolves which `X-VideoGen-Client` value the hosted MCP server should stamp on
 * upstream VideoGen API calls for this request.
 *
 * Priority:
 * 1. ChatGPT Apps path (`/mcp/chatgpt`) → always `chatgpt`
 * 2. Incoming `X-VideoGen-Client` request header (from the host's MCP config)
 * 3. `vg_client` query param on the MCP URL (for hosts that only accept a URL,
 *    e.g. Claude custom connectors)
 * 4. Default `mcp`
 *
 * Unknown / blank header or `vg_client` values are ignored (never throw); we fall
 * through to the next priority and finally default to `mcp`.
 */

const VIDEOGEN_CLIENT_HEADER = "x-videogen-client";
const VG_CLIENT_QUERY_PARAM = "vg_client";

export const resolveMcpUpstreamClientId = ({
  mcpPath,
  requestUrl,
  requestHeaders,
}: {
  mcpPath: string;
  requestUrl: string;
  requestHeaders: { [header: string]: string | string[] | undefined };
}): McpUpstreamClientId => {
  if (mcpPath === "/mcp/chatgpt") {
    return "chatgpt";
  }

  const rawHeader = requestHeaders[VIDEOGEN_CLIENT_HEADER];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const fromHeader = getMcpUpstreamClientId({ raw: headerValue });

  if (fromHeader != null) {
    return fromHeader;
  }

  try {
    const url = new URL(requestUrl, "http://localhost");
    const fromQuery = getMcpUpstreamClientId({
      raw: url.searchParams.get(VG_CLIENT_QUERY_PARAM),
    });

    if (fromQuery != null) {
      return fromQuery;
    }
  } catch {
    // Malformed URL — fall through to default.
  }

  return "mcp";
};
