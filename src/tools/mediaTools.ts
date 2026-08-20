import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  toGenerateAvatarRequest,
  toGenerateImageRequest,
  toGenerateMotionGraphicRequest,
  toGenerateMusicRequest,
  toGenerateSoundEffectRequest,
  toGenerateVideoClipRequest,
  toImage3dEffectRequest,
  toRemoveImageBackgroundRequest,
  toRemoveVideoBackgroundRequest,
  toTextToSpeechRequest,
  toUpscaleImageRequest,
  toUpscaleVideoRequest,
  toVectorizeImageRequest,
} from "../adapters/mediaToolAdapters";
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
import { type McpOperations, dropUndefined } from "../operations";
import {
  listToolExecutionsOutputSchema,
  toolExecutionOutputSchema,
} from "../outputSchemas";
import {
  DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PRIVATE_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

type MediaPreviewToolMeta = typeof MEDIA_PREVIEW_TOOL_META;

const pollToTerminal = ({
  getClient,
  attachMediaPreviewWidget,
}: {
  getClient: GetVideoGenClient;
  attachMediaPreviewWidget: boolean;
}) => ({
  poll: (toolExecutionId: string) => getClient().tools.getToolExecutionInfo({ toolExecutionId }),
  idKey: "toolExecutionId" as const,
  attachMediaPreviewWidget,
});

export function registerMediaToolTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
  mediaPreviewMeta: MediaPreviewToolMeta | null,
): void {
  // Do not put openai/outputTemplate on generate_* tool descriptors. ChatGPT
  // would render an empty preview as soon as generation starts, then another
  // on every get_tool_execution poll. Attach the widget on the result only
  // once signed media URLs exist.
  const mediaGeneration = pollToTerminal({
    getClient,
    attachMediaPreviewWidget: mediaPreviewMeta != null,
  });

  server.registerTool(
    "generate_image",
    {
      title: "Generate image",
      description:
        "Generate an image from a text prompt, optionally conditioned on source images (image-to-image) and actor, product, or visual-style entity ids. Typically takes 15–60 seconds. Tell the user that wait up front.",
      inputSchema: generateImageInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.generateImage(toGenerateImageRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "generate_video_clip",
    {
      title: "Generate video clip",
      description:
        "Generate a video clip from a text prompt, source images, source videos, spokenDialogue, or reference audio. quality is optional (LOW, STANDARD, HIGH, or MAX). Typically takes 1–3 minutes (HIGH/MAX can be longer). Tell the user that wait up front and keep polling calmly.",
      inputSchema: generateVideoClipInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.generateVideoClip(toGenerateVideoClipRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "text_to_speech",
    {
      title: "Text to speech",
      description: "Convert text into spoken audio using a selectable voice.",
      inputSchema: textToSpeechInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.textToSpeech(toTextToSpeechRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "generate_sound_effect",
    {
      title: "Generate sound effect",
      description: "Generate a sound effect from a text prompt.",
      inputSchema: generateSoundEffectInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.generateSoundEffect(toGenerateSoundEffectRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "generate_music",
    {
      title: "Generate music",
      description:
        "Generate a music track from a text prompt. Typically takes 1–5 minutes depending on track length. Tell the user that wait up front.",
      inputSchema: generateMusicInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.generateMusic(toGenerateMusicRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "generate_motion_graphic",
    {
      title: "Generate motion graphic",
      description:
        "Generate an animated motion graphic video from a text prompt. Best for precise text animations (typing effects, kinetic typography, lower thirds) that stock or generated footage can't express. Outputs a transparent WebM overlay by default; set transparentBackground to false for an opaque MP4. Optionally pass reference media file ids to display or animate. Typically takes 2–5 minutes because VideoGen writes animation code and then renders it; complex prompts can take longer. Tell the user that wait before starting and keep polling calmly — a healthy in-progress job is expected.",
      inputSchema: generateMotionGraphicInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.generateMotionGraphic(toGenerateMotionGraphicRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "generate_avatar",
    {
      title: "Generate avatar",
      description:
        "Generate a talking-head avatar video from an ACTOR entity and an uploaded audio file. Pass actorEntityId and optionally set avatarQuality. Typically takes a few minutes (longer for longer audio). Tell the user that wait up front.",
      inputSchema: generateAvatarInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.generateAvatar(toGenerateAvatarRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "vectorize_image",
    {
      title: "Vectorize image",
      description: "Convert a raster image into a vector (SVG).",
      inputSchema: vectorizeImageInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.vectorizeImage(toVectorizeImageRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "remove_image_background",
    {
      title: "Remove image background",
      description: "Remove the background from an image.",
      inputSchema: removeImageBackgroundInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().tools.removeImageBackground(toRemoveImageBackgroundRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "remove_video_background",
    {
      title: "Remove video background",
      description: "Remove the background from a video.",
      inputSchema: removeVideoBackgroundInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().tools.removeVideoBackground(toRemoveVideoBackgroundRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "upscale_image",
    {
      title: "Upscale image",
      description: "Increase the resolution of an image.",
      inputSchema: upscaleImageInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.upscaleImage(toUpscaleImageRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "upscale_video",
    {
      title: "Upscale video",
      description: "Increase the resolution of a video.",
      inputSchema: upscaleVideoInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.upscaleVideo(toUpscaleVideoRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "image_3d_effect",
    {
      title: "Image 3D effect",
      description: "Add 3D parallax motion to a still image, producing a video.",
      inputSchema: image3dEffectInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().tools.image3dEffect(toImage3dEffectRequest(args)),
        ...mediaGeneration,
        controls: {},
      }),
  );

  server.registerTool(
    "list_tool_executions",
    {
      title: "List tool executions",
      description: "List past tool executions, most recent first.",
      inputSchema: listToolExecutionsInputSchema,
      outputSchema: listToolExecutionsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().tools.listToolExecutions(dropUndefined(args))),
  );

  // No tool-level outputTemplate: ChatGPT polls this while generation is still
  // running, and a descriptor-level widget would spawn an empty preview on every
  // poll. Attach the widget on the result only once media URLs exist.
  server.registerTool(
    "get_tool_execution",
    {
      title: "Get tool execution",
      description: "Fetch the current status and results of a single tool execution.",
      inputSchema: getToolExecutionInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(
        () => getClient().tools.getToolExecutionInfo({ toolExecutionId: args.toolExecutionId }),
        { attachMediaPreviewWidget: true },
      ),
  );

  server.registerTool(
    "cancel_tool_execution",
    {
      title: "Cancel tool execution",
      description: "Request cancellation of an in-progress tool execution.",
      inputSchema: cancelToolExecutionInputSchema,
      outputSchema: toolExecutionOutputSchema,
      annotations: DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().tools.cancelToolExecution({ toolExecutionId: args.toolExecutionId }),
      ),
  );
}
