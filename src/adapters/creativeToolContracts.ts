import { z } from "zod";

export const DEFAULT_MCP_AI_STYLE = "cinematic photo-real footage";

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
  .enum(["STANDARD", "HIGH", "MAX"])
  .describe("Video generation quality. Omit to use workspace settings.");

const styleSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Visual style in plain language. Omit for cinematic photo-real AI images.");

const languageSchema = z
  .string()
  .optional()
  .describe("Output language as a BCP-47 code, such as en, es, or fr.");

const voiceIdSchema = z.string().optional().describe("Voice id from list_tts_voices.");

const avatarQualitySchema = imageQualitySchema.describe(
  "Avatar generation quality tier. Applies when actorEntityId is provided. Omit to use workspace settings.",
);

const actorEntityIdSchema = z
  .string()
  .optional()
  .describe(
    "Id of an ACTOR entity (vg_enti_...) with an image reference. When set, narration is delivered by that actor avatar.",
  );

export const scriptToVideoInputSchema = z.strictObject({
  script: z.string().min(1).describe("Narration script, spoken verbatim."),
  style: styleSchema,
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: imageQualitySchema.optional(),
  language: languageSchema,
  voiceId: voiceIdSchema,
  actorEntityId: actorEntityIdSchema,
  avatarQuality: avatarQualitySchema.optional(),
});

export const voiceoverToVideoInputSchema = z.strictObject({
  fileId: z.string().describe("Uploaded voiceover audio file id."),
  style: styleSchema,
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: imageQualitySchema.optional(),
  language: languageSchema,
});

export const slideshowToVideoInputSchema = z.strictObject({
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
});

const storyboardSceneSchema = z.strictObject({
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

export const storyboardToVideoInputSchema = z.strictObject({
  scenes: z
    .array(storyboardSceneSchema)
    .min(1)
    .describe("Ordered scenes. Every scene requires a visual `prompt`."),
  style: styleSchema,
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: videoQualitySchema.optional(),
});

export const promptToVideoClipInputSchema = z.strictObject({
  prompt: z.string().min(1).describe("Description of the short video clip."),
  imageFileIds: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("Optional reference image file ids."),
  durationSeconds: z.number().int().min(1).max(15).optional(),
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: videoQualitySchema.optional(),
});

export const generateImageInputSchema = z.strictObject({
  prompt: z.string().min(1).describe("Description of the image to generate."),
  imageFileIds: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("Optional reference image file ids."),
  aspectRatio: creativeAspectRatioSchema.optional(),
  quality: imageQualitySchema.optional(),
});

export const generateVideoClipInputSchema = z
  .strictObject({
    prompt: z.string().min(1).optional().describe("Description of the video to generate."),
    imageFileIds: z.array(z.string()).optional().describe("Optional reference image file ids."),
    videoFileIds: z.array(z.string()).optional().describe("Optional reference video file ids."),
    audioFileIds: z.array(z.string()).optional().describe("Optional reference audio file ids."),
    generateAudio: z
      .boolean()
      .optional()
      .describe("Whether the result must include generated audio."),
    durationSeconds: z.number().int().min(1).max(15).nullable().optional(),
    aspectRatio: creativeAspectRatioSchema.optional(),
    quality: videoQualitySchema.optional(),
  })
  .refine(
    (input) =>
      input.prompt != null ||
      (input.imageFileIds?.length ?? 0) > 0 ||
      (input.videoFileIds?.length ?? 0) > 0 ||
      (input.audioFileIds?.length ?? 0) > 0,
    { message: "Provide a prompt or at least one reference media file." },
  );

export const textToSpeechInputSchema = z.strictObject({
  text: z.string().min(1).describe("Text to speak."),
  voiceId: z.string().describe("Voice id from list_tts_voices."),
  language: z.string().nullable().optional().describe("ISO-639-1 pronunciation language hint."),
  speed: z.number().min(0.5).max(2).optional().describe("Speech-rate multiplier."),
});

export const generateSoundEffectInputSchema = z.strictObject({
  prompt: z.string().min(1).describe("Description of the sound effect."),
  durationSeconds: z.number().min(1).max(30).nullable().optional(),
});

export const generateMusicInputSchema = z.strictObject({
  prompt: z.string().min(1).describe("Genre, mood, instrumentation, and tempo."),
});

export const generateMotionGraphicInputSchema = z.strictObject({
  prompt: z.string().min(1).describe("Description of the animated motion graphic."),
  fileIds: z.array(z.string()).optional().describe("Optional reference media file ids."),
  durationSeconds: z.number().int().min(1).max(300).nullable().optional(),
  aspectRatio: creativeAspectRatioSchema.optional(),
  transparentBackground: z
    .boolean()
    .default(true)
    .describe(
      "Render a transparent WebM for use as an overlay on other video or images. Defaults to true. Set to false for an opaque MP4.",
    ),
});

export const generateAvatarInputSchema = z.strictObject({
  actorEntityId: z
    .string()
    .describe("Id of an ACTOR entity (vg_enti_...) with at least one image reference."),
  avatarQuality: avatarQualitySchema.optional(),
  audioFileId: z.string().describe("Audio file id for the avatar to lip-sync."),
});

const imageFileIdSchema = z.string().describe("Source image file id.");
const videoFileIdSchema = z.string().describe("Source video file id.");

export const vectorizeImageInputSchema = z.strictObject({ imageFileId: imageFileIdSchema });
export const removeImageBackgroundInputSchema = z.strictObject({
  imageFileId: imageFileIdSchema,
});
export const removeVideoBackgroundInputSchema = z.strictObject({
  videoFileId: videoFileIdSchema,
});
export const upscaleImageInputSchema = z.strictObject({ imageFileId: imageFileIdSchema });
export const upscaleVideoInputSchema = z.strictObject({ videoFileId: videoFileIdSchema });
export const image3dEffectInputSchema = z.strictObject({ imageFileId: imageFileIdSchema });

export const exportProjectInputSchema = z.strictObject({
  projectId: z.string().describe("Project id to export."),
  quality: z
    .enum(["STANDARD", "HIGH", "FULL_HIGH", "ULTRA_HIGH"])
    .optional()
    .describe("Export quality. Omit for the default."),
});

export const remixProjectInputSchema = z.strictObject({
  projectId: z.string().describe("Project id to edit."),
  edits: z
    .array(z.enum(["CAPTIONS", "TRANSITIONS", "ANIMATE_IMAGES"]))
    .min(1)
    .describe("Curated edits to apply in order."),
  saveAsNewProject: z.boolean().optional().describe("Apply edits to a copy of the project."),
});

export type CreativeAspectRatio = z.infer<typeof creativeAspectRatioSchema>;
export type RemixEdit = z.infer<typeof remixProjectInputSchema>["edits"][number];
