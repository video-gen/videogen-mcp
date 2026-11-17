import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import type { McpOperations } from "../operations";
import { fileOutputSchema } from "../outputSchemas";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

export function registerFileUrlImportTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: Pick<McpOperations, "respondSdk">,
): void {
  server.registerTool(
    "import_video_from_url",
    {
      title: "Import a video link",
      description:
        "Import a public video link without starting generation. Use before video_to_video for external links. Returns fileImportId immediately; poll get_video_url_import. If that snapshot contains selection, show its videos and ask the user which to import, then call this tool with the original sourceUrl and chosen videoIndex. Never silently select the first video. A successful import returns fileId for video_to_video.videoFileId. Private, login-only and protected sources may be unavailable.",
      inputSchema: z.object({
        url: z.string().url().max(2048),
        videoIndex: z.number().int().min(1).max(20).optional(),
      }),
      outputSchema: z.object({ fileImportId: z.string() }),
      annotations: WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS,
    },
    async ({ url, videoIndex }) =>
      await respondSdk(() =>
        getClient().files.createFileUrlImport({
          url,
          ...(videoIndex == null ? {} : { videoIndex }),
        }),
      ),
  );

  server.registerTool(
    "get_video_url_import",
    {
      title: "Get video link import",
      description:
        "Poll fileImportId from import_video_from_url until succeeded, failed or cancelled. A failed snapshot with selection requires the user's choice, not another identical retry. Once succeeded, pass its fileId to video_to_video.videoFileId; never generate before import succeeds.",
      inputSchema: z.object({ fileImportId: z.string().min(1) }),
      outputSchema: z
        .object({
          fileImportId: z.string(),
          status: z.enum([
            "pending",
            "running",
            "succeeded",
            "failed",
            "cancelled",
          ]),
          progressPercentage: z.number(),
          attemptIndex: z.number(),
          fileId: z.string().nullable(),
          file: fileOutputSchema.nullable(),
          error: z.object({ message: z.string() }).passthrough().nullable(),
          selection: z
            .object({
              sourceUrl: z.string(),
              videos: z.array(
                z.object({
                  videoIndex: z.number(),
                  title: z.string().nullable(),
                  durationSeconds: z.number().nullable(),
                }),
              ),
            })
            .optional(),
        })
        .passthrough(),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().files.getFileUrlImport(args)),
  );
}
