import { isJSONRPCResponse, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Loosely matches a `tools/list` result: we only need to read each tool's
// `_meta.securitySchemes`, and `z.looseObject` preserves every other field
// (name, title, description, inputSchema, annotations, execution, ...) verbatim.
const listToolsResultSchema = z.looseObject({
  tools: z.array(z.looseObject({ _meta: z.looseObject({ securitySchemes: z.unknown() }).optional() })),
});

/**
 * Mirrors each tool's `_meta.securitySchemes` to a TOP-LEVEL `securitySchemes`
 * on the outbound `tools/list` response.
 *
 * OpenAI's Apps SDK reads a tool's OAuth requirement from a top-level
 * `securitySchemes`, but `@modelcontextprotocol/sdk`'s `tools/list` serializer
 * emits only a fixed field set (name, title, description, inputSchema,
 * annotations, execution, `_meta`) and silently drops any other top-level field.
 * So we cannot set `securitySchemes` at registration time; we advertise it under
 * `_meta.securitySchemes` there (see `advertiseOAuthSecuritySchemes` in
 * `buildServer`) and copy it to the top level here, on the JSON-RPC message the
 * transport is about to send. `_meta.securitySchemes` stays as a
 * backward-compatibility mirror. Non-`tools/list` messages, and tools without an
 * advertised scheme, pass through untouched.
 */
export function mirrorSecuritySchemesToTopLevel(message: JSONRPCMessage): JSONRPCMessage {
  if (!isJSONRPCResponse(message)) {
    return message;
  }

  const parsed = listToolsResultSchema.safeParse(message.result);
  if (!parsed.success) {
    return message;
  }

  const tools = parsed.data.tools.map((tool) => {
    const securitySchemes = tool._meta?.securitySchemes;

    return securitySchemes == null ? tool : { ...tool, securitySchemes };
  });

  return { ...message, result: { ...message.result, tools } };
}
