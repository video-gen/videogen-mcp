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
        "Return a page of narration voices with voiceId, display name, language, accent, description, deprecation status, and supportsDirectToolExecution. Use a voice with supportsDirectToolExecution true for text_to_speech; nextCursor fetches more voices.",
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
      description: "Return supported narration and caption languages as languageCode and English name pairs. Use these codes when selecting workflow output languages.",
      inputSchema: listLanguagesInputSchema,
      outputSchema: listLanguagesOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().resources.listLanguages(dropUndefined(args))),
  );
}
