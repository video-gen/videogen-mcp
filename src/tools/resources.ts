import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetVideoGenClient } from "../client";
import { listLanguagesInputSchema, listTtsVoicesInputSchema } from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import { listLanguagesOutputSchema, listTtsVoicesOutputSchema } from "../outputSchemas";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";

export function registerResourceTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: McpOperations,
): void {
  server.registerTool(
    "list_tts_voices",
    {
      title: "List text-to-speech voices",
      description:
        "List available text-to-speech voices for narration, text_to_speech, and workflows.",
      inputSchema: listTtsVoicesInputSchema,
      outputSchema: listTtsVoicesOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().resources.listTtsVoices(dropUndefined(args))),
  );

  server.registerTool(
    "list_languages",
    {
      title: "List languages",
      description: "List supported languages for narration and captions.",
      inputSchema: listLanguagesInputSchema,
      outputSchema: listLanguagesOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().resources.listLanguages(dropUndefined(args))),
  );
}
