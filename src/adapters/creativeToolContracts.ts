import { z } from "zod";
import { MCP_AI_STYLE_FIELD_DESCRIPTION } from "./aiStylePresetExamples";

export { DEFAULT_MCP_AI_STYLE } from "./aiStylePresetExamples";

/**
 * Creative MCP inputs use `z.object` (unknown keys stripped), not
 * `z.strictObject` (unknown keys rejected). ChatGPT Apps may send fields from a
 * stale published plugin schema; rejecting them fails the call, triggers a
 * retry with a narrower body, and duplicates the media-preview widget. Extra
 * keys are ignored and never forwarded to the API.
 */

/**
 * Aspect ratio as a width:height pair (e.g. 16 and 9 for 16:9). Not pixel
 * dimensions. Matches the Developer API `AspectRatio` shape.
 */
export const creativeAspectRatioSchema = z
  .object({
    width: z.number().positive().describe("Aspect-ratio width unit (e.g. 16 for 16:9)."),
    height: z.number().positive().describe("Aspect-ratio height unit (e.g. 9 for 16:9)."),
  })
  .describe(
    "Output aspect ratio as width:height units (not pixels). Example: { width: 16, height: 9 }.",
  );

const imageQualitySchema = z
  .enum(["LOW", "STANDARD", "HIGH", "MAX"])
  .describe("Generation quality. Omit to use workspace settings.");

const videoQualitySchema = z
  .enum(["LOW", "STANDARD", "HIGH", "MAX"])
  .describe("Video generation quality. Omit to use workspace settings.");

const storyboardImageQualitySchema = z
  .enum(["HIGH", "MAX"])
  .describe(
    "Image generation quality for scene opening frames. Optional; defaults to HIGH. Does not change video generation quality.",
  );

const styleSchema = z.string().min(1).optional().describe(MCP_AI_STYLE_FIELD_DESCRIPTION);

const languageSchema = z
  .string()
  .optional()
  .describe("Output language as a BCP-47 code, such as en, es, or fr.");

const voiceIdSchema = z
  .string()
  .optional()
  .describe("Catalog display name (e.g. Matilda) or voice id from list_tts_voices.");

const avatarQualitySchema = imageQualitySchema.describe(
  "Avatar generation quality tier. Applies when actorEntityId is provided. Omit to use workspace settings.",
);

const actorEntityIdSchema = z
  .string()
  .optional()
  .describe(
    "Id of an ACTOR entity (vg_enti_...) with an image reference. When set, narration is delivered by that actor avatar.",
  );

const autoExportSchema = z
  .boolean()
  .optional()
  .describe(
    "When true (the default), the run stays in progress until an MP4 is ready. Use downloadUrl from the result. Set false only if you will call remix_project and then export_project yourself.",
  );

export const scriptToVideoInputSchema = z.object({
  script: z.string().min(1).describe("Narration script, spoken verbatim."),
  style: styleSchema,
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: imageQualitySchema.optional(),
  language: languageSchema,
  voiceId: voiceIdSchema,
  actorEntityId: actorEntityIdSchema,
  avatarQuality: avatarQualitySchema.optional(),
  autoExport: autoExportSchema,
});

export const voiceoverToVideoInputSchema = z.object({
  fileId: z.string().describe("Uploaded voiceover audio file id."),
  style: styleSchema,
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: imageQualitySchema.optional(),
  language: languageSchema,
  autoExport: autoExportSchema,
});

export const slideshowToVideoInputSchema = z.object({
  fileId: z.string().describe("Uploaded PDF or slideshow file id."),
  slideScripts: z
    .array(z.string())
    .optional()
    .describe("Optional narration for each slide, in order."),
  aspectRatio: creativeAspectRatioSchema.optional(),
  language: languageSchema,
  voiceId: voiceIdSchema,
  actorEntityId: actorEntityIdSchema,
  avatarQuality: avatarQualitySchema.optional(),
  slideshowThemeEntityId: z
    .string()
    .optional()
    .describe(
      "Optional id of a SLIDESHOW_THEME entity (vg_enti_...) whose reference board defines the shared slide design system. Omit when converting an uploaded deck's original pages; VideoGen derives a theme from those pages in the background.",
    ),
  autoExport: autoExportSchema,
});

const storyboardSceneSchema = z.object({
  prompt: z.string().min(1).describe("Required visual description for this scene."),
  voiceoverScript: z.string().optional().describe("Optional words spoken during this scene."),
  title: z.string().optional().describe("Optional scene title."),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(15)
    .nullable()
    .optional()
    .describe("Optional scene duration in whole seconds (1-15)."),
});

export const storyboardToVideoInputSchema = z.object({
  scenes: z
    .array(storyboardSceneSchema)
    .min(1)
    .describe("Ordered scenes. Every scene requires a visual `prompt`."),
  style: styleSchema,
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: storyboardImageQualitySchema.optional(),
  autoExport: autoExportSchema,
});

export const promptToVideoClipInputSchema = z.object({
  prompt: z.string().min(1).describe("Description of the short video clip."),
  imageFileIds: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("Optional reference image file ids."),
  durationSeconds: z.number().int().min(1).max(30).optional(),
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: videoQualitySchema.optional(),
  autoExport: autoExportSchema,
});

export const generateImageInputSchema = z.object({
  prompt: z.string().min(1).describe("Description of the image to generate."),
  imageFileIds: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("Optional reference image file ids."),
  entityIds: z
    .array(z.string())
    .optional()
    .describe(
      "Optional actor, product, or visual-style entity ids (vg_enti_...) used as identity/reference.",
    ),
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: imageQualitySchema.optional(),
});

export const generateVideoClipInputSchema = z
  .object({
    prompt: z.string().min(1).optional().describe("Description of the video to generate."),
    startFrameFileId: z
      .string()
      .optional()
      .describe("Optional opening-frame still file id. Used as the first frame of the clip."),
    imageFileIds: z.array(z.string()).optional().describe("Optional reference image file ids."),
    videoFileIds: z.array(z.string()).optional().describe("Optional reference video file ids."),
    audioFileIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional reference audio file ids used to lip-sync from a recording. Use spokenDialogue to have the model speak a line it generates itself.",
      ),
    spokenDialogue: z
      .string()
      .optional()
      .describe(
        "Exact line the subject should speak as native lip-synced speech. The model synthesizes the voice from this text.",
      ),
    voiceDescription: z
      .string()
      .optional()
      .describe(
        "Natural-language description of the voice that speaks spokenDialogue. Used when spokenDialogue is set.",
      ),
    generateAudio: z
      .boolean()
      .optional()
      .describe("Whether the result must include generated audio."),
    suppressBackgroundMusic: z
      .boolean()
      .optional()
      .describe(
        "When true, the clip will not include a musical soundtrack. Spoken dialogue and environmental sound are still allowed. Use this when background music will be added separately.",
      ),
    durationSeconds: z
      .number()
      .int()
      .min(1)
      .max(30)
      .nullable()
      .optional()
      .describe("Optional clip length in whole seconds (1 to 30). Omit or pass null for Auto."),
    aspectRatio: creativeAspectRatioSchema.optional(),
    quality: videoQualitySchema.optional(),
  })
  .refine(
    (input) =>
      input.prompt != null ||
      input.startFrameFileId != null ||
      (input.imageFileIds?.length ?? 0) > 0 ||
      (input.videoFileIds?.length ?? 0) > 0 ||
      (input.audioFileIds?.length ?? 0) > 0 ||
      (input.spokenDialogue != null && input.spokenDialogue.trim().length > 0),
    { message: "Provide a prompt, spokenDialogue, or at least one reference media file." },
  );

export const textToSpeechInputSchema = z.object({
  text: z.string().min(1).describe("Text to speak."),
  voiceId: z
    .string()
    .describe("Catalog display name (e.g. Matilda) or voice id from list_tts_voices."),
  language: z.string().nullable().optional().describe("ISO-639-1 pronunciation language hint."),
  speed: z.number().min(0.5).max(2).optional().describe("Speech-rate multiplier."),
});

export const generateSoundEffectInputSchema = z.object({
  prompt: z.string().min(1).describe("Description of the sound effect."),
  durationSeconds: z.number().min(1).max(30).nullable().optional(),
});

export const generateMusicInputSchema = z.object({
  prompt: z.string().min(1).describe("Genre, mood, instrumentation, and tempo."),
});

const motionGraphicSubToolModeSchema = z
  .enum(["AUTO", "ENABLED", "DISABLED"])
  .describe(
    "AUTO uses the capability when the plan allows it. ENABLED requires it. DISABLED turns it off.",
  );

export const generateMotionGraphicInputSchema = z.object({
  prompt: z.string().min(1).describe("Description of the animated motion graphic."),
  fileIds: z.array(z.string()).optional().describe("Optional reference media file ids."),
  entityIds: z
    .array(z.string())
    .optional()
    .describe("Optional actor, product, or visual-style entity ids (vg_enti_...)."),
  durationSeconds: z.number().int().min(1).max(300).nullable().optional(),
  aspectRatio: creativeAspectRatioSchema.optional(),
  transparentBackground: z
    .boolean()
    .default(true)
    .describe(
      "Render a transparent WebM for use as an overlay on other video or images. Defaults to true. Set to false for an opaque MP4.",
    ),
  subToolModes: z
    .object({
      generateImages: motionGraphicSubToolModeSchema.optional(),
      generateVideoClips: motionGraphicSubToolModeSchema.optional(),
      generateVoiceover: motionGraphicSubToolModeSchema.optional(),
      searchStockMedia: motionGraphicSubToolModeSchema.optional(),
    })
    .optional()
    .describe(
      "Optional per-capability controls for generated images, video clips, voiceover, and stock media. Omit to use AUTO for every capability.",
    ),
});

export const generateAvatarInputSchema = z.object({
  actorEntityId: z
    .string()
    .describe(
      "Id of a built-in stock actor or an ACTOR entity (vg_enti_...) with an image reference.",
    ),
  avatarQuality: avatarQualitySchema.optional(),
  audioFileId: z.string().describe("Audio file id for the avatar to lip-sync."),
});

const imageFileIdSchema = z.string().describe("Source image file id.");
const videoFileIdSchema = z.string().describe("Source video file id.");

export const vectorizeImageInputSchema = z.object({ imageFileId: imageFileIdSchema });
export const removeImageBackgroundInputSchema = z.object({
  imageFileId: imageFileIdSchema,
});
export const removeVideoBackgroundInputSchema = z.object({
  videoFileId: videoFileIdSchema,
});
export const upscaleImageInputSchema = z.object({ imageFileId: imageFileIdSchema });
export const upscaleVideoInputSchema = z.object({ videoFileId: videoFileIdSchema });
export const image3dEffectInputSchema = z.object({ imageFileId: imageFileIdSchema });

export const exportProjectInputSchema = z.object({
  projectId: z.string().describe("Project id to export."),
  quality: z
    .enum(["STANDARD", "HIGH", "FULL_HIGH", "ULTRA_HIGH"])
    .optional()
    .describe("Export quality. Omit for the default."),
});

const remixEditSchema = z
  .enum(["CAPTIONS", "TRANSITIONS", "CONVERT_IMAGES_TO_VIDEOS", "ZOOM"])
  .describe(
    "CAPTIONS enables captions. TRANSITIONS adds section and asset transitions. CONVERT_IMAGES_TO_VIDEOS generates AI video clips from every still (expensive; same as Add Motion). ZOOM is cheap Ken Burns camera motion on stills. Use ZOOM for zoom, pan, or light motion. Never use CONVERT_IMAGES_TO_VIDEOS when the user asked for zoom.",
  );

/**
 * Older agents sent ANIMATE_IMAGES for this edit. Keep accepting that token
 * so existing callers do not break, but do not advertise it (it reads like
 * cheap motion).
 */
const remixEditInputSchema = z.preprocess((value) => {
  return value === "ANIMATE_IMAGES" ? "CONVERT_IMAGES_TO_VIDEOS" : value;
}, remixEditSchema);

export const remixProjectInputSchema = z.object({
  projectId: z.string().describe("Project id to edit."),
  edits: z
    .array(remixEditInputSchema)
    .min(1)
    .describe(
      "Curated edits to apply in order. CONVERT_IMAGES_TO_VIDEOS generates AI video clips from every still and is expensive. Use ZOOM for cheap Ken Burns camera motion.",
    ),
  saveAsNewProject: z.boolean().optional().describe("Apply edits to a copy of the project."),
});

export type CreativeAspectRatio = z.infer<typeof creativeAspectRatioSchema>;
export type RemixEdit = z.infer<typeof remixProjectInputSchema>["edits"][number];
