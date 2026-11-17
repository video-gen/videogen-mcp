import {
  type JSONRPCMessage,
  isJSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
const listing = z.looseObject({
  tools: z.array(z.looseObject({ name: z.string() })),
});
/** Compatibility tools remain callable but are never offered to new clients. */
export const hideLegacyVideoEditTools = (
  message: JSONRPCMessage,
): JSONRPCMessage => {
  if (!isJSONRPCResponse(message)) return message;
  const parsed = listing.safeParse(message.result);
  if (!parsed.success) return message;
  return {
    ...message,
    result: {
      ...message.result,
      tools: parsed.data.tools.filter(
        (tool) =>
          tool.name !== "remix_project" &&
          tool.name !== "list_project_remix_actions",
      ),
    },
  };
};
