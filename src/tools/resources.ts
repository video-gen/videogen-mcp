import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetVideoGenClient } from "../client";
import {
  listAvatarPresentersInputSchema,
  listLanguagesInputSchema,
  listTtsVoicesInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import {
  listAvatarPresentersOutputSchema,
  listLanguagesOutputSchema,
  listTtsVoicesOutputSchema,
} from "../outputSchemas";

export function registerResourceTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: McpOperations,
): void {
  server.registerTool(
    "list_avatar_presenters",
    {
      title: "List avatar presenters",
      description:
        "List available talking-head avatar presenters for generate_avatar and workflows.",
      inputSchema: listAvatarPresentersInputSchema,
      outputSchema: listAvatarPresentersOutputSchema,
    },
    async (args) =>
      await respondSdk(() => getClient().resources.listAvatarPresenters(dropUndefined(args))),
  );

  server.registerTool(
    "list_tts_voices",
    {
      title: "List text-to-speech voices",
      description:
        "List available text-to-speech voices for narration, text_to_speech, and workflows.",
      inputSchema: listTtsVoicesInputSchema,
      outputSchema: listTtsVoicesOutputSchema,
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
    },
    async () => await respondSdk(() => getClient().resources.listLanguages()),
  );
}
