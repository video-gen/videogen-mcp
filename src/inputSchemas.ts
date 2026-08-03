import type { JsonObject } from "@videogen/sdk";
import { z } from "zod";

/**
 * Pins a permissive, JSON-Schema-representable runtime schema to type `T`.
 * Complex request fields (remix actions, caption styles, storyboard scenes,
 * pronunciation replacements) are large unions we do not re-model field-by-field
 * in zod. `z.custom` would infer `T` but cannot be represented in JSON Schema
 * (which MCP requires), so we keep a loose object/array schema for the wire
 * format. The API still validates these fields.
 */
export function sdkFieldSchema<T>(
  runtimeSchema: z.ZodTypeAny,
  description: string,
): z.ZodType<T> {
  // We intentionally use an unsafe `as` assertion here because the loose runtime
  // schema exists only to produce a JSON Schema for MCP; the actual field is
  // validated by the API, and its true type is the SDK's `T`.
  return runtimeSchema.describe(description) as unknown as z.ZodType<T>;
}

const looseObject = z.record(z.string(), z.unknown());

/** Control fields shared by composite (start + poll) tools. Stripped from the request before forwarding. */
export const pollControlShape = {
  wait: z
    .boolean()
    .optional()
    .describe(
      "Whether to block until the operation reaches a terminal state (succeeded/failed/cancelled). Defaults to true. Set false to return immediately with the run/execution id.",
    ),
  pollIntervalMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How often to poll while waiting, in milliseconds."),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Maximum time to wait for a terminal state before giving up, in milliseconds.",
    ),
};

export const cursorField = z
  .string()
  .optional()
  .describe("Pagination cursor from a previous response's `nextCursor`.");

export const limitField = z
  .number()
  .int()
  .positive()
  .max(100)
  .optional()
  .describe("Maximum number of items to return.");

export const selfOnlyField = z
  .boolean()
  .optional()
  .describe(
    "When true, restrict results to items created by the API key owner rather than the whole team.",
  );

export const aspectRatioSchema = z
  .object({
    width: z
      .number()
      .positive()
      .describe("Aspect-ratio width (e.g. 16 for 16:9)."),
    height: z
      .number()
      .positive()
      .describe("Aspect-ratio height (e.g. 9 for 16:9)."),
  })
  .describe(
    "Output aspect ratio as a width:height pair (e.g. { width: 16, height: 9 }).",
  );

export const visualStyleSchema = z
  .object({
    type: z
      .enum(["STOCK", "AI_IMAGE", "ENTITY"])
      .describe(
        "STOCK pulls stock footage/images; AI_IMAGE generates a styled image per section; ENTITY matches a visual-style entity's reference images.",
      ),
    aiStyle: z
      .string()
      .optional()
      .describe(
        "Required when type is AI_IMAGE: free-form description of the look for every image.",
      ),
    entityId: z
      .string()
      .optional()
      .describe(
        "Required when type is ENTITY: id of a VISUAL_STYLE entity (vg_enti_...).",
      ),
    restyleFeaturedBRollWithAiStyle: z
      .boolean()
      .optional()
      .describe(
        "When true (AI_IMAGE only), re-render featured b-roll images in the chosen style.",
      ),
  })
  .describe("Visual style for the generated b-roll.");

export const visualPacingSchema = z
  .enum(["FAST", "MEDIUM", "SLOW"])
  .describe("How quickly visuals change. Defaults to MEDIUM.");

export const imageQualitySchema = z
  .enum(["LOW", "STANDARD", "HIGH", "MAX"])
  .describe(
    "AI image generation quality tier. LOW is fastest/cheapest; MAX is highest quality. Optional; when omitted, your workspace's Default AI quality is used.",
  );

export const watermarkModeSchema = z
  .enum(["NONE", "VIDEO_GEN", "AUTO"])
  .describe("Whether to apply a VideoGen watermark to the output.");

export const remixActionsSchema = sdkFieldSchema<unknown[]>(
  z.array(looseObject),
  "Edits applied to the project, each an object with a `type`: SET_BACKGROUND_MUSIC, SET_LOGO, ENABLE_CAPTIONS, DISABLE_CAPTIONS, ADD_TRANSITIONS, RESIZE_PROJECT, CLEAN_UP_TRANSCRIPT, or CONVERT_IMAGES_TO_VIDEOS (plus that action's own fields). Provide at least two for a polished result, e.g. [{ type: 'ENABLE_CAPTIONS' }, { type: 'SET_BACKGROUND_MUSIC' }].",
);

export const captionStyleSchema = sdkFieldSchema<JsonObject | null>(
  looseObject.nullable(),
  "Caption style overrides object, or null to hide captions. Omit for the default caption style.",
);

const languageField = z
  .string()
  .optional()
  .describe("Output language as a BCP-47 code (e.g. 'en', 'es', 'fr'). Defaults to English.");

const voiceIdField = z.string().optional().describe("Text-to-speech voice id (vg_voic_...).");

const voiceSpeedField = z.number().positive().optional().describe("Speech rate multiplier.");

const avatarPresenterField = z
  .string()
  .optional()
  .describe("Talking-head avatar presenter id (vg_pres_...).");

const logoFileIdField = z
  .string()
  .optional()
  .describe("Uploaded logo image file id (vg_file_...) to overlay.");

const workflowAgentContextField = z
  .string()
  .optional()
  .describe("Production notes for the AI (visual direction that is never spoken).");

const projectIdField = z.string().describe("Project id.");

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

const uploadFileTypeField = z
  .enum(["IMAGE", "VIDEO", "AUDIO"])
  .optional()
  .describe("File type. Inferred when omitted.");

export const emptyInputSchema = {};

export const getMeInputSchema = emptyInputSchema;

export const getAppDeepLinkInputSchema = {
  action: z
    .enum([
      "OPEN_UPGRADE",
      "OPEN_ENABLE_TOP_UPS",
      "OPEN_INVITE_TEAMMATES",
      "OPEN_PURCHASE_CREDITS",
      "OPEN_SUBMIT_FEEDBACK",
      "OPEN_RATE_CARD",
      "OPEN_HELP_ARTICLE",
      "OPEN_MANAGE_INTEGRATION",
      "OPEN_INTEGRATIONS_PICKER",
      "OPEN_LANGUAGE_SELECTOR",
      "NAVIGATE",
    ])
    .describe(
      "Assistant COMMON action to deep-link into the VideoGen app (opens a modal or navigates after sign-in).",
    ),
  destination: z
    .string()
    .optional()
    .describe(
      "Required for NAVIGATE. In-app keys like PROJECTS, BILLING_SETTINGS, SUPPORT; or HELP_CENTER / API_DOCS.",
    ),
  articleSlug: z
    .string()
    .optional()
    .describe("Required for OPEN_HELP_ARTICLE. Help-center article slug / search query."),
  provider: z
    .string()
    .optional()
    .describe("Required for OPEN_MANAGE_INTEGRATION. Integration provider id (e.g. GOOGLE, SLACK)."),
  capability: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Optional for OPEN_INTEGRATIONS_PICKER. Capability filter (e.g. KNOWLEDGE_SOURCE), or null for all.",
    ),
  category: z
    .enum(["bug", "feature_request", "improvement"])
    .nullable()
    .optional()
    .describe("Optional for OPEN_SUBMIT_FEEDBACK. Ticket category, or null to let the user pick."),
  text: z
    .string()
    .nullable()
    .optional()
    .describe("Optional for OPEN_SUBMIT_FEEDBACK. Prefills the ticket description (capped)."),
  suggestedLocale: z
    .string()
    .nullable()
    .optional()
    .describe("Optional for OPEN_LANGUAGE_SELECTOR. Suggested locale code (e.g. en-US)."),
};

export const listProjectsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
  includeUiProjects: z
    .boolean()
    .optional()
    .describe("Include projects created in the VideoGen dashboard, not just API-created ones."),
};

export const getProjectInputSchema = { projectId: projectIdField };

export const getProjectExportInputSchema = {
  projectId: z.string().describe("Project id that owns the export."),
  exportId: z.string().describe("Export id (vg_expo_...) from export_project."),
};

export const exportProjectInputSchema = {
  projectId: z.string().describe("Project id to export."),
  quality: z
    .enum(["STANDARD", "HIGH", "FULL_HIGH", "ULTRA_HIGH"])
    .optional()
    .describe("Export quality tier."),
  ...pollControlShape,
};

export const remixProjectInputSchema = {
  projectId: z.string().describe("Project id to remix."),
  remixActions: remixActionsSchema,
  saveAsNewProject: z
    .boolean()
    .optional()
    .describe(
      "When true, save the remixed result as a new project instead of editing in place.",
    ),
};

export const listProjectRemixActionsInputSchema = { projectId: projectIdField };

export const scriptToVideoInputSchema = {
  script: z.string().describe("The narration script. Narrated verbatim; not rewritten."),
  visualStyle: visualStyleSchema,
  aspectRatio: aspectRatioSchema.optional(),
  visualPacing: visualPacingSchema.optional(),
  quality: imageQualitySchema.optional(),
  language: languageField,
  voiceId: voiceIdField,
  voiceSpeed: voiceSpeedField,
  avatarPresenterId: avatarPresenterField,
  featuredBRollFileIds: z
    .array(z.string())
    .optional()
    .describe("Uploaded image/video file ids to feature as B-roll."),
  workflowAgentContext: workflowAgentContextField,
  remixActions: remixActionsSchema.optional(),
  ...pollControlShape,
};

export const voiceoverToVideoInputSchema = {
  fileId: z.string().describe("Uploaded voiceover audio file id (vg_file_...)."),
  visualStyle: visualStyleSchema,
  aspectRatio: aspectRatioSchema.optional(),
  visualPacing: visualPacingSchema.optional(),
  quality: imageQualitySchema.optional(),
  language: languageField,
  captionStyle: captionStyleSchema.optional(),
  logoFileId: logoFileIdField,
  workflowAgentContext: workflowAgentContextField,
  remixActions: remixActionsSchema.optional(),
  ...pollControlShape,
};

export const slideshowToVideoInputSchema = {
  fileId: z.string().describe("Uploaded PDF/slideshow file id (vg_file_...)."),
  slideScripts: z
    .array(z.string())
    .optional()
    .describe("Optional per-slide narration scripts, in slide order."),
  aspectRatio: aspectRatioSchema.optional(),
  language: languageField,
  voiceId: voiceIdField,
  voiceSpeed: voiceSpeedField,
  avatarPresenterId: avatarPresenterField,
  captionStyle: captionStyleSchema.optional(),
  logoFileId: logoFileIdField,
  remixActions: remixActionsSchema.optional(),
  ...pollControlShape,
};

export const storyboardToVideoInputSchema = {
  scenes: sdkFieldSchema<unknown[]>(
    z.array(z.record(z.string(), z.unknown())),
    "Ordered storyboard scenes. Each scene describes its narration/text and how its visual is generated.",
  ),
  defaultGeneration: sdkFieldSchema<JsonObject | null>(
    z.record(z.string(), z.unknown()).nullable(),
    "Default per-scene generation settings applied when a scene omits its own.",
  ).optional(),
  defaultDurationSeconds: z
    .number()
    .positive()
    .optional()
    .describe("Default duration in seconds for scenes that omit their own."),
  quality: imageQualitySchema.optional(),
  aspectRatio: aspectRatioSchema.optional(),
  workflowAgentContext: workflowAgentContextField,
  ...pollControlShape,
};

export const promptToVideoClipInputSchema = {
  prompt: z
    .string()
    .describe(
      "Text prompt describing the video to generate (e.g. 'A golden retriever running through a sunlit meadow in slow motion, cinematic').",
    ),
  imageFileIds: z
    .array(z.string())
    .max(4)
    .optional()
    .describe("Uploaded reference image file ids that guide the opening frame."),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(15)
    .optional()
    .describe("Desired clip length in whole seconds (1-15). Defaults to 10."),
  aspectRatio: aspectRatioSchema.optional(),
  quality: z
    .enum(["STANDARD", "HIGH"])
    .optional()
    .describe("Video (and opening-frame) quality tier. Defaults to STANDARD."),
  ...pollControlShape,
};

export const listWorkflowRunsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getWorkflowRunInputSchema = {
  workflowRunId: z.string().describe("Workflow run id (vg_work_...)."),
};

export const cancelWorkflowRunInputSchema = getWorkflowRunInputSchema;

export const generateImageInputSchema = {
  prompt: z.string().describe("Text description of the image to generate."),
  quality: imageQualitySchema.optional(),
  imageFileIds: imageFileIdsField,
  aspectRatio: aspectRatioSchema.optional(),
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const generateVideoClipInputSchema = {
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
};

export const textToSpeechInputSchema = {
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
};

export const generateSoundEffectInputSchema = {
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
};

export const generateMusicInputSchema = {
  prompt: z.string().describe("Description of the music to generate."),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const generateMotionGraphicInputSchema = {
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
};

export const generateAvatarInputSchema = {
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
};

export const vectorizeImageInputSchema = {
  imageFileId: imageFileIdField,
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const removeImageBackgroundInputSchema = {
  imageFileId: imageFileIdField,
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const removeVideoBackgroundInputSchema = {
  videoFileId: videoFileIdField,
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const upscaleImageInputSchema = {
  imageFileId: imageFileIdField,
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const upscaleVideoInputSchema = {
  videoFileId: videoFileIdField,
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const image3dEffectInputSchema = {
  imageFileId: imageFileIdField,
  watermarkMode: watermarkModeSchema.optional(),
  numResults: numResultsField,
  isOutputTemporary: isOutputTemporaryField,
  ...pollControlShape,
};

export const listToolExecutionsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getToolExecutionInputSchema = {
  toolExecutionId: z.string().describe("Tool execution id (vg_tool_...)."),
};

export const cancelToolExecutionInputSchema = getToolExecutionInputSchema;

export const listAvatarPresentersInputSchema = {
  cursor: cursorField,
  limit: limitField,
  voiceId: z.string().optional().describe("Filter presenters compatible with this voice id."),
};

export const listTtsVoicesInputSchema = {
  cursor: cursorField,
  limit: limitField,
  includeDeprecatedVoices: z
    .boolean()
    .optional()
    .describe("Include deprecated voices in the results."),
};

export const listLanguagesInputSchema = emptyInputSchema;

export const uploadFileLocalInputSchema = {
  filePath: z.string().describe("Absolute path to a local file to upload."),
  displayName: z
    .string()
    .optional()
    .describe("Display name for the file. Defaults to the source file name."),
  type: uploadFileTypeField,
};

export const uploadFileHostedInputSchema = {
  fileData: z.string().describe("Base64-encoded contents of the file to upload."),
  displayName: z
    .string()
    .optional()
    .describe("Display name for the file. Defaults to 'upload'."),
  type: uploadFileTypeField,
};

export const createFileUploadInputSchema = {
  displayName: z.string().describe("Display name for the file."),
  type: z
    .enum(["IMAGE", "VIDEO", "AUDIO", "PDF", "SLIDESHOW"])
    .optional()
    .describe("File type. Inferred after processing when omitted."),
  isTemporary: z
    .boolean()
    .optional()
    .describe(
      "When true, the file is temporary (guaranteed available for 24 hours, not analyzed for search). Defaults to false.",
    ),
};

export const getFileInputSchema = {
  fileId: z.string().describe("File id (vg_file_...)."),
  wait: z
    .boolean()
    .optional()
    .describe(
      "When true, poll until the file finishes processing and a rendition is ready. Defaults to false (a single fetch).",
    ),
  pollIntervalMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How often to poll while waiting, in milliseconds."),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum time to wait for processing before giving up, in milliseconds."),
};

export const listFilesInputSchema = { cursor: cursorField, limit: limitField };

export const openUploaderInputSchema = emptyInputSchema;
