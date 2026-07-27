import { z } from "zod";

const jsonRpcMethodSchema = z.object({
  method: z.string(),
});

/**
 * Extracts the JSON-RPC method name from an MCP request body when present.
 * Returns null for empty bodies, batches, or non-objects — never throws.
 */
export function getMcpMethodFromBody(body: unknown): string | null {
  const parsed = jsonRpcMethodSchema.safeParse(body);

  return parsed.success ? parsed.data.method : null;
}

const toolsListResultSchema = z.object({
  tools: z.array(z.object({ name: z.string() })),
});

/**
 * Reads tool names from a `tools/list` JSON-RPC response result when the shape
 * matches. Returns null otherwise (e.g. errors, other methods).
 */
export function getToolNamesFromListResult(result: unknown): string[] | null {
  const parsed = toolsListResultSchema.safeParse(result);

  return parsed.success ? parsed.data.tools.map((tool) => tool.name) : null;
}

const toolResultMetaSchema = z.object({
  _meta: z.object({
    "mcp/www_authenticate": z.array(z.string()).min(1),
  }),
});

/** True when a JSON-RPC result carries a tool-level OAuth WWW-Authenticate challenge. */
export function getHasToolAuthChallenge(result: unknown): boolean {
  return toolResultMetaSchema.safeParse(result).success;
}

export type McpRequestLogFields = {
  method: string | null;
  httpStatus: number | null;
  hasAuthorization: boolean;
  toolNames?: string[] | null;
  authChallengeEmitted?: boolean;
};

/**
 * Formats a structured discovery/auth log line. Never includes tokens,
 * Authorization values, cookies, or tool result bodies — only method, status,
 * whether a bearer was present, and (for tools/list) tool count + names.
 */
export function formatMcpRequestLogLine({
  method,
  httpStatus,
  hasAuthorization,
  toolNames,
  authChallengeEmitted,
}: McpRequestLogFields): string {
  const parts = [
    `[videogen-mcp]`,
    `ts=${new Date().toISOString()}`,
    `method=${method ?? "unknown"}`,
    `httpStatus=${httpStatus ?? "pending"}`,
    `hasAuthorization=${hasAuthorization ? "true" : "false"}`,
  ];

  if (toolNames != null) {
    parts.push(`toolCount=${toolNames.length}`);
    parts.push(`toolNames=${toolNames.join(",")}`);
  }

  if (authChallengeEmitted != null) {
    parts.push(`authChallengeEmitted=${authChallengeEmitted ? "true" : "false"}`);
  }

  return `${parts.join(" ")}\n`;
}

/** Writes a structured discovery/auth line to stderr (see `formatMcpRequestLogLine`). */
export function logMcpRequest(fields: McpRequestLogFields): void {
  process.stderr.write(formatMcpRequestLogLine(fields));
}
