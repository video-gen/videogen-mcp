import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import { type McpOperations, dropUndefined } from "../operations";
import { cursorField, limitField } from "../schemas";

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
      inputSchema: {
        cursor: cursorField,
        limit: limitField,
        voiceId: z.string().optional().describe("Filter presenters compatible with this voice id."),
      },
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
      inputSchema: {
        cursor: cursorField,
        limit: limitField,
        includeDeprecatedVoices: z
          .boolean()
          .optional()
          .describe("Include deprecated voices in the results."),
      },
    },
    async (args) => await respondSdk(() => getClient().resources.listTtsVoices(dropUndefined(args))),
  );

  server.registerTool(
    "list_languages",
    {
      title: "List languages",
      description: "List supported languages for narration and captions.",
      inputSchema: {},
    },
    async () => await respondSdk(() => getClient().resources.listLanguages()),
  );
}
