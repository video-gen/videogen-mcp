import { z } from "zod";

/**
 * Tools that advertise `securitySchemes: [{ type: "noauth" }]` and must remain
 * callable without a bearer on the OAuth-enabled HTTP server (ChatGPT can surface
 * them before linking). Keep in sync with the `securitySchemes` declarations on
 * those tools.
 */
export const NOAUTH_TOOL_NAMES = new Set(["get_app_deep_link", "open_uploader"]);

const toolsCallMessageSchema = z.object({
  method: z.literal("tools/call"),
  params: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
});

/**
 * True when the JSON-RPC body (single message or batch) includes a `tools/call`
 * for a tool that requires OAuth / API credentials. Unknown tool names are
 * treated as protected. Used by the default HTTP transport to emit a transport
 * `401` + `WWW-Authenticate` before the MCP layer (Cursor / Claude lazy auth).
 */
export function getCallsProtectedTool(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];

  for (const message of messages) {
    const parsed = toolsCallMessageSchema.safeParse(message);

    if (!parsed.success) {
      continue;
    }

    const toolName = parsed.data.params?.name;

    if (toolName == null || toolName === "") {
      return true;
    }

    if (!NOAUTH_TOOL_NAMES.has(toolName)) {
      return true;
    }
  }

  return false;
}
