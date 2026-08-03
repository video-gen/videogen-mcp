import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MEDIA_PREVIEW_TOOL_META } from "../appWidget";
import type { GetVideoGenClient } from "../client";
import {
  cancelToolExecutionInputSchema,
  generateAvatarInputSchema,
  generateImageInputSchema,
  generateMotionGraphicInputSchema,
  generateMusicInputSchema,
  generateSoundEffectInputSchema,
  generateVideoClipInputSchema,
  getToolExecutionInputSchema,
  image3dEffectInputSchema,
  listToolExecutionsInputSchema,
  removeImageBackgroundInputSchema,
  removeVideoBackgroundInputSchema,
  textToSpeechInputSchema,
  upscaleImageInputSchema,
  upscaleVideoInputSchema,
  vectorizeImageInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import {
  listToolExecutionsOutputSchema,
  toolExecutionOutputSchema,
} from "../outputSchemas";

type MediaPreviewToolMeta = typeof MEDIA_PREVIEW_TOOL_META;

const pollToTerminal = (getClient: GetVideoGenClient) => ({
  poll: (toolExecutionId: string) => getClient().tools.getToolExecutionInfo({ toolExecutionId }),
  idKey: "toolExecutionId" as const,
});

export function registerMediaToolTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
  mediaPreviewMeta: MediaPreviewToolMeta | null,
): void {
  const mediaPreviewToolFields =
    mediaPreviewMeta != null ? { _meta: mediaPreviewMeta } : {};

  server.registerTool(
    "generate_image",
    {
      title: "Generate image",
      description:
        "Generate an image from a text prompt, optionally conditioned on source images (image-to-image).",
      inputSchema: generateImageInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: generateVideoClipInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: textToSpeechInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: generateSoundEffectInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: generateMusicInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: generateMotionGraphicInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: generateAvatarInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: vectorizeImageInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: removeImageBackgroundInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: removeVideoBackgroundInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: upscaleImageInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: upscaleVideoInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: image3dEffectInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().tools.image3dEffect(dropUndefined(rest)),
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
      inputSchema: listToolExecutionsInputSchema,
      outputSchema: listToolExecutionsOutputSchema,
    },
    async (args) =>
      await respondSdk(() => getClient().tools.listToolExecutions(dropUndefined(args))),
  );

  server.registerTool(
    "get_tool_execution",
    {
      title: "Get tool execution",
      description: "Fetch the current status and results of a single tool execution.",
      inputSchema: getToolExecutionInputSchema,
      outputSchema: toolExecutionOutputSchema,
      ...mediaPreviewToolFields,
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
      inputSchema: cancelToolExecutionInputSchema,
      outputSchema: toolExecutionOutputSchema,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().tools.cancelToolExecution({ toolExecutionId: args.toolExecutionId }),
      ),
  );
}
