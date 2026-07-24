import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import {
  aspectRatioSchema,
  cursorField,
  imageQualitySchema,
  limitField,
  pollControlShape,
  sdkFieldSchema,
  selfOnlyField,
  watermarkModeSchema,
} from "../schemas";

const numResultsField = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Number of result variations to generate.");

const isOutputTemporaryField = z
  .boolean()
  .optional()
  .describe("When true, the output is temporary and not persisted to your library.");

const imageFileIdsField = z
  .array(z.string())
  .optional()
  .describe("Source image file ids (vg_file_...) for image-conditioned generation.");

const videoFileIdsField = z
  .array(z.string())
  .optional()
  .describe("Source video file ids (vg_file_...) for video-conditioned generation.");

const imageFileIdField = z.string().describe("Source image file id (vg_file_...).");

const videoFileIdField = z.string().describe("Source video file id (vg_file_...).");

const pollToTerminal = (getClient: GetVideoGenClient) => ({
  poll: (toolExecutionId: string) => getClient().tools.getToolExecutionInfo({ toolExecutionId }),
  idKey: "toolExecutionId" as const,
});

export function registerMediaToolTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
): void {
  server.registerTool(
    "generate_image",
    {
      title: "Generate image",
      description:
        "Generate an image from a text prompt, optionally conditioned on source images (image-to-image).",
      inputSchema: {
        prompt: z.string().describe("Text description of the image to generate."),
        quality: imageQualitySchema.optional(),
        imageFileIds: imageFileIdsField,
        aspectRatio: aspectRatioSchema.optional(),
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.generateImage(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "generate_video_clip",
    {
      title: "Generate video clip",
      description:
        "Generate a video clip from a text prompt, source images, or source videos. quality is optional (STANDARD, HIGH, or MAX; LOW is not supported).",
      inputSchema: {
        quality: z
          .enum(["STANDARD", "HIGH", "MAX"])
          .optional()
          .describe(
            "Video generation quality tier (STANDARD, HIGH, or MAX). Optional; when omitted, your workspace's Default AI quality for video is used.",
          ),
        prompt: z.string().optional().describe("Text description of the video to generate."),
        imageFileIds: imageFileIdsField,
        videoFileIds: videoFileIdsField,
        audioFileIds: z
          .array(z.string())
          .optional()
          .describe("Source audio file ids (vg_file_...) to drive the clip."),
        generateAudio: z.boolean().optional().describe("Whether to generate audio for the clip."),
        durationSeconds: z
          .number()
          .positive()
          .nullable()
          .optional()
          .describe("Requested clip duration in seconds."),
        aspectRatio: aspectRatioSchema.optional(),
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.generateVideoClip(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "text_to_speech",
    {
      title: "Text to speech",
      description: "Convert text into spoken audio using a selectable voice.",
      inputSchema: {
        ttsText: z.string().describe("The text to speak."),
        voiceId: z.string().describe("Voice id from list_tts_voices (vg_voic_...)."),
        speechLanguageCode: z
          .string()
          .nullable()
          .optional()
          .describe("BCP-47 language code for the narration."),
        pronunciationReplacements: sdkFieldSchema<unknown[]>(
          z.array(z.record(z.string(), z.unknown())),
          "Custom pronunciation replacements to apply before synthesis.",
        ).optional(),
        autoExpandPronunciationReplacements: z
          .boolean()
          .optional()
          .describe("Whether to auto-expand pronunciation replacements."),
        voiceSpeed: z.number().positive().optional().describe("Speech rate multiplier."),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.textToSpeech(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "generate_sound_effect",
    {
      title: "Generate sound effect",
      description: "Generate a sound effect from a text prompt.",
      inputSchema: {
        prompt: z.string().describe("Description of the sound effect."),
        durationSeconds: z
          .number()
          .positive()
          .nullable()
          .optional()
          .describe("Requested duration in seconds."),
        promptInfluence: z
          .number()
          .nullable()
          .optional()
          .describe("How strongly the prompt guides generation (0-1)."),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.generateSoundEffect(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "generate_music",
    {
      title: "Generate music",
      description: "Generate a music track from a text prompt.",
      inputSchema: {
        prompt: z.string().describe("Description of the music to generate."),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.generateMusic(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "generate_motion_graphic",
    {
      title: "Generate motion graphic",
      description:
        "Generate an animated motion graphic video from a text prompt. Best for precise text animations (typing effects, kinetic typography, lower thirds) that stock or generated footage can't express. Optionally pass reference media file ids to display or animate.",
      inputSchema: {
        prompt: z.string().describe("Description of the animated motion graphic to generate."),
        fileIds: z
          .array(z.string())
          .optional()
          .describe(
            "Optional reference media file ids (vg_file_...) the motion graphic may display or animate.",
          ),
        durationSeconds: z
          .number()
          .int()
          .optional()
          .describe("Length in seconds, a whole number from 1 to 300. Defaults to 5."),
        aspectRatio: aspectRatioSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.generateMotionGraphic(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "generate_avatar",
    {
      title: "Generate avatar",
      description:
        "Generate a talking-head avatar video from a presenter and an uploaded audio file.",
      inputSchema: {
        avatarPresenterId: z
          .string()
          .describe("Presenter id from list_avatar_presenters (vg_pres_...)."),
        audioFileId: z
          .string()
          .describe("Uploaded audio file id (vg_file_...) for the avatar to lip-sync."),
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.generateAvatar(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "vectorize_image",
    {
      title: "Vectorize image",
      description: "Convert a raster image into a vector (SVG).",
      inputSchema: {
        imageFileId: imageFileIdField,
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.vectorizeImage(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "remove_image_background",
    {
      title: "Remove image background",
      description: "Remove the background from an image.",
      inputSchema: {
        imageFileId: imageFileIdField,
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.removeImageBackground(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "remove_video_background",
    {
      title: "Remove video background",
      description: "Remove the background from a video.",
      inputSchema: {
        videoFileId: videoFileIdField,
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.removeVideoBackground(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "upscale_image",
    {
      title: "Upscale image",
      description: "Increase the resolution of an image.",
      inputSchema: {
        imageFileId: imageFileIdField,
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.upscaleImage(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "upscale_video",
    {
      title: "Upscale video",
      description: "Increase the resolution of a video.",
      inputSchema: {
        videoFileId: videoFileIdField,
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.upscaleVideo(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "image_3d_effect",
    {
      title: "Image 3D effect",
      description: "Add 3D parallax motion to a still image, producing a video.",
      inputSchema: {
        imageFileId: imageFileIdField,
        watermarkMode: watermarkModeSchema.optional(),
        numResults: numResultsField,
        isOutputTemporary: isOutputTemporaryField,
        ...pollControlShape,
      },
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.image3DEffect(dropUndefined(rest)),
        ...pollToTerminal(getClient),
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "list_tool_executions",
    {
      title: "List tool executions",
      description: "List past tool executions, most recent first.",
      inputSchema: { cursor: cursorField, limit: limitField, selfOnly: selfOnlyField },
    },
    async (args) =>
      await respondSdk(() => getClient().tools.listToolExecutions(dropUndefined(args))),
  );

  server.registerTool(
    "get_tool_execution",
    {
      title: "Get tool execution",
      description: "Fetch the current status and results of a single tool execution.",
      inputSchema: { toolExecutionId: z.string().describe("Tool execution id (vg_tool_...).") },
    },
    async (args) =>
      await respondSdk(() =>
        getClient().tools.getToolExecutionInfo({ toolExecutionId: args.toolExecutionId }),
      ),
  );

  server.registerTool(
    "cancel_tool_execution",
    {
      title: "Cancel tool execution",
      description: "Request cancellation of an in-progress tool execution.",
      inputSchema: { toolExecutionId: z.string().describe("Tool execution id (vg_tool_...).") },
    },
    async (args) =>
      await respondSdk(() =>
        getClient().tools.cancelToolExecution({ toolExecutionId: args.toolExecutionId }),
      ),
  );
}
