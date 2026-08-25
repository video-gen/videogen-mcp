import { z } from "zod";
import { aspectRatioSchema } from "./inputSchemas";

/**
 * MCP output schemas advertised in `tools/list` and validated against
 * `structuredContent`. Document fields models need; `.passthrough()` keeps
 * extra API fields valid.
 *
 * Small / stable nests are modeled explicitly. Large evolving nests (full
 * FileInfo / transcript / analysis metadata) document the useful top-level
 * keys and passthrough the rest — do not 1:1-clone OpenAPI here.
 *
 * Composite tools (start + poll) return either the start response or the
 * terminal snapshot depending on `wait`, so shared fields stay required and
 * poll-only fields are optional.
 */

const apiErrorSchema = z
  .object({
    message: z.string().describe("Human-readable error description."),
    code: z.string().nullish().describe("Machine-readable error code."),
    requirement: z
      .object({
        type: z.string().describe("Requirement type (e.g. purchase_add_on)."),
        details: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .nullish()
      .describe("What is needed to resolve the error, when applicable."),
    internalErrorCode: z.string().nullish().describe("Opaque code for support."),
  })
  .passthrough()
  .nullable()
  .describe("Error details when status is failed; otherwise null.");

const jobStatusSchema = z
  .enum(["pending", "running", "succeeded", "failed", "cancelled"])
  .describe("Job status: pending, running, succeeded, failed, or cancelled.");

const fileSourceSchema = z
  .object({
    status: z
      .enum(["pending", "ready", "failed", "skipped"])
      .describe("Rendition status."),
    url: z.string().nullish().describe("Signed URL when status is ready."),
    expiresAt: z.number().nullish().describe("Unix expiry for url."),
    width: z.number().nullish().describe("Rendition width in pixels."),
    height: z.number().nullish().describe("Rendition height in pixels."),
    fileBytes: z.number().nullish().describe("Rendition size in bytes."),
  })
  .passthrough()
  .describe("A file rendition source (thumbnail, preview, download, …).");

/**
 * Useful FileInfo fields for models. Full transcript / analysis metadata and
 * other evolving keys pass through without being re-modeled here.
 */
const fileInfoSchema = z
  .object({
    fileId: z.string().describe("File id (vg_file_...)."),
    type: z
      .string()
      .nullish()
      .describe("File type once processing has determined it."),
    scope: z
      .enum(["GLOBAL", "PROJECT", "EXPORT", "TEMPORARY", "ENTITY"])
      .optional()
      .describe("File scope."),
    displayName: z.string().optional().describe("Display name for the file."),
    description: z.string().nullish().describe("File description when analyzed."),
    durationSeconds: z
      .number()
      .nullish()
      .describe("Duration in seconds for video/audio; null for images."),
    transcriptText: z
      .string()
      .nullish()
      .describe("Plain transcript text when available."),
    downloadUrl: z.string().nullish().describe("Signed download URL when ready."),
    downloadUrlExpiresAt: z.number().nullish().describe("Unix expiry for downloadUrl."),
    thumbnailUrl: z.string().nullish().describe("Signed thumbnail URL when available."),
    thumbnailUrlExpiresAt: z.number().nullish().describe("Unix expiry for thumbnailUrl."),
    thumbnailSource: fileSourceSchema.nullish(),
    previewSource: fileSourceSchema.nullish(),
    downloadSource: fileSourceSchema.nullish(),
    hlsSource: fileSourceSchema.nullish(),
    isPublicPreviewEnabled: z.boolean().optional(),
    publicHlsUrl: z.string().nullish(),
    publicPlaybackId: z.string().nullish(),
    sourceToolType: z.string().optional(),
    sourceToolExecutionId: z.string().optional(),
  })
  .passthrough()
  .describe("File metadata with signed URLs when hydrated.");

const remixActionRunSchema = z
  .object({
    remixActionId: z.string().describe("Remix action id (vg_rmix_...)."),
    type: z.string().describe("Remix action type (e.g. ENABLE_CAPTIONS)."),
    status: jobStatusSchema,
    projectId: z.string().describe("Project this remix action edits (vg_proj_...)."),
    projectUrl: z.string().describe("Deep link to the project in the VideoGen editor."),
    progressPercentage: z.number().describe("Completion progress 0-100."),
    attemptIndex: z.number().describe("Current or latest attempt index."),
    error: apiErrorSchema,
  })
  .passthrough()
  .describe("Status of one remix action on a project.");

const toolSuccessResultSchema = z
  .object({
    fileId: z.string().describe("Generated file id (vg_file_...)."),
    type: z.string().describe("Generated file type."),
    downloadUrl: z.string().nullable().describe("Signed download URL."),
    downloadUrlExpiresAt: z.number().nullable().describe("Unix expiry for downloadUrl."),
    thumbnailUrl: z.string().nullable().describe("Signed thumbnail URL, or null."),
    thumbnailUrlExpiresAt: z.number().nullable().describe("Unix expiry for thumbnailUrl."),
    file: fileInfoSchema.describe("Hydrated file metadata."),
  })
  .passthrough()
  .describe("One generated result from a succeeded tool execution.");

const executedToolSchema = z
  .object({
    toolExecutionId: z.string().describe("Tool execution id (vg_tool_...)."),
    status: jobStatusSchema,
    toolType: z.string().describe("Tool name (e.g. GENERATE_IMAGE)."),
    progressPercentage: z.number().describe("Completion progress 0-100."),
    attemptIndex: z.number().describe("Current or latest attempt index."),
    results: z
      .array(toolSuccessResultSchema)
      .describe("Generated results; empty until succeeded."),
    error: apiErrorSchema,
  })
  .passthrough()
  .describe("Full tool-execution status snapshot.");

/** WorkflowRun list/get shape (no start-only remixActionIds). */
const workflowRunSchema = z
  .object({
    workflowRunId: z.string().describe("Workflow run id (vg_work_...)."),
    status: jobStatusSchema,
    workflowType: z.string().describe("Workflow type."),
    progressPercentage: z.number().describe("Completion progress 0-100."),
    attemptIndex: z.number().describe("Current or latest attempt index."),
    projectId: z.string().describe("Project created for this run (vg_proj_...)."),
    projectUrl: z.string().describe("Deep link to the project in the VideoGen editor."),
    error: apiErrorSchema,
  })
  .passthrough()
  .describe("Workflow run status snapshot.");

const ttsVoiceSchema = z
  .object({
    voiceId: z.string().describe("Voice id (vg_voic_...)."),
    languageCode: z.string().describe("Locale tag (e.g. en-US)."),
    displayName: z.string().describe("Human-readable voice name."),
    displayGender: z.enum(["MALE", "FEMALE", "NEUTRAL"]).describe("Voice gender."),
    accent: z.string().nullish().describe("Accent label, when set."),
    description: z.string().nullish().describe("Voice description."),
    supportsDirectToolExecution: z
      .boolean()
      .describe("Whether the voice can be used with text_to_speech directly."),
    supportsAllLanguages: z
      .boolean()
      .describe("Whether the voice can speak any language."),
    isDeprecated: z.boolean().describe("Whether the voice is deprecated."),
  })
  .passthrough()
  .describe("A text-to-speech voice.");

const languageSchema = z
  .object({
    languageCode: z.string().describe("BCP-47 / remix language code."),
    name: z.string().describe("Human-readable English name."),
  })
  .passthrough()
  .describe("A supported language.");

export const meOutputSchema = z
  .object({
    apiKeyId: z.string().describe("Id of the API key used for this request."),
    apiKeyNickname: z.string().describe("Nickname of the API key."),
    email: z.string().describe("Account email."),
    displayName: z.string().nullable().describe("Account display name, or null."),
    teamId: z.string().describe("Team id the API key belongs to."),
  })
  .passthrough()
  .describe("Account and team behind the authenticated API key.");

export const projectOutputSchema = z
  .object({
    projectId: z.string().describe("Project id (vg_proj_...)."),
    assistantId: z
      .string()
      .nullable()
      .describe("Assistant conversation id, or null for older projects."),
    title: z.string().describe("Project title."),
    status: z.enum(["generating", "ready"]).describe("High-level project status."),
    projectUrl: z.string().describe("Deep link to open the project in the VideoGen editor."),
    createdAt: z.number().describe("Unix timestamp when the project was created."),
    updatedAt: z.number().describe("Unix timestamp when the project was last updated."),
    aspectRatio: aspectRatioSchema,
  })
  .passthrough()
  .describe("Project metadata.");

export const listProjectsOutputSchema = z
  .object({
    projects: z.array(projectOutputSchema).describe("Projects, most recently updated first."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z
      .string()
      .nullable()
      .describe("Cursor for the next page, or null when hasMore is false."),
  })
  .passthrough()
  .describe("Paginated list of projects.");

/**
 * `export_project` returns `{ exportId }` when wait is false, otherwise a full
 * ProjectExport snapshot (status, downloadUrl, …).
 */
export const exportProjectOutputSchema = z
  .object({
    exportId: z.string().describe("Export id (vg_expo_...)."),
    projectId: z.string().optional().describe("Exported project id (present after polling)."),
    status: jobStatusSchema.optional(),
    progressPercentage: z
      .number()
      .optional()
      .describe("Completion progress 0-100 (present after polling)."),
    attemptIndex: z.number().optional().describe("Current or latest attempt index."),
    downloadUrl: z
      .string()
      .nullable()
      .optional()
      .describe("Signed MP4 download URL when succeeded; otherwise null."),
    downloadUrlExpiresAt: z
      .number()
      .nullable()
      .optional()
      .describe("Unix expiry for downloadUrl."),
    thumbnailUrl: z.string().nullable().optional().describe("Signed thumbnail URL when ready."),
    thumbnailUrlExpiresAt: z
      .number()
      .nullable()
      .optional()
      .describe("Unix expiry for thumbnailUrl."),
    exportFileId: z
      .string()
      .nullable()
      .optional()
      .describe("Exported MP4 file id when succeeded."),
    file: fileInfoSchema.nullable().optional().describe("Hydrated export file metadata."),
    error: apiErrorSchema.optional(),
  })
  .passthrough()
  .describe(
    "Export start id, or full export status after waiting (includes downloadUrl when succeeded).",
  );

/** Full export snapshot from `get_project_export` / polled `export_project`. */
export const projectExportOutputSchema = exportProjectOutputSchema;

export const remixProjectOutputSchema = z
  .object({
    projectId: z.string().describe("Edited project id (or the duplicate when saveAsNewProject)."),
    projectUrl: z.string().describe("Deep link to the project in the VideoGen editor."),
    remixActionIds: z
      .array(z.string())
      .describe("Remix action ids, one per requested action in order."),
  })
  .passthrough()
  .describe("Accepted remix actions for a project.");

export const listRemixActionsOutputSchema = z
  .object({
    remixActions: z.array(remixActionRunSchema).describe("Remix actions for the project."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z.string().nullable().describe("Cursor for the next page, or null."),
  })
  .passthrough()
  .describe("Paginated remix-action status list.");

/**
 * Workflow start tools return StartWorkflowRunResponse when wait is false, or a
 * WorkflowRun snapshot when wait is true / after polling.
 */
export const workflowRunOutputSchema = z
  .object({
    workflowRunId: z
      .string()
      .describe(
        "Workflow run id (vg_work_...). Keep it paired with this response's projectId and projectUrl; a retry returns a new tuple.",
      ),
    projectId: z
      .string()
      .describe(
        "Project created for this exact workflow attempt (vg_proj_...). A retry creates a different project.",
      ),
    projectUrl: z
      .string()
      .describe(
        "Deep link to the project created for this exact workflow attempt. Keep it paired with workflowRunId; a retry returns a new URL.",
      ),
    remixActionIds: z
      .array(z.string())
      .optional()
      .describe("Remix action ids from the start response (empty when none requested)."),
    status: jobStatusSchema.optional(),
    workflowType: z.string().optional().describe("Workflow type (present after polling)."),
    progressPercentage: z
      .number()
      .optional()
      .describe("Completion progress 0-100 (present after polling)."),
    attemptIndex: z.number().optional().describe("Current or latest attempt index."),
    error: apiErrorSchema.optional(),
  })
  .passthrough()
  .describe(
    "Workflow start metadata, or full run status after waiting (status/progress when polled).",
  );

export const listWorkflowRunsOutputSchema = z
  .object({
    workflowRuns: z.array(workflowRunSchema).describe("Workflow runs, most recent first."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z.string().nullable().describe("Cursor for the next page, or null."),
  })
  .passthrough()
  .describe("Paginated list of workflow runs.");

/**
 * Media tools return `{ toolExecutionId }` when wait is false, otherwise a full
 * ExecutedTool snapshot (status, results, …).
 */
export const toolExecutionOutputSchema = z
  .object({
    toolExecutionId: z.string().describe("Tool execution id (vg_tool_...)."),
    status: jobStatusSchema.optional(),
    toolType: z.string().optional().describe("Tool name (e.g. GENERATE_IMAGE)."),
    progressPercentage: z
      .number()
      .optional()
      .describe("Completion progress 0-100 (present after polling)."),
    attemptIndex: z.number().optional().describe("Current or latest attempt index."),
    results: z
      .array(toolSuccessResultSchema)
      .optional()
      .describe("Generated results with download URLs when succeeded."),
    error: apiErrorSchema.optional(),
  })
  .passthrough()
  .describe(
    "Tool execution id, or full execution status after waiting (results when succeeded).",
  );

export const listToolExecutionsOutputSchema = z
  .object({
    toolExecutions: z
      .array(executedToolSchema)
      .describe("Tool executions, most recent first."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z.string().nullable().describe("Cursor for the next page, or null."),
  })
  .passthrough()
  .describe("Paginated list of tool executions.");

export const fileOutputSchema = fileInfoSchema;

export const fileUploadOutputSchema = z
  .object({
    fileId: z.string().describe("File id to use after uploading bytes (vg_file_...)."),
    uploadUrl: z
      .string()
      .describe("Pre-signed URL: PUT raw file bytes here with no Authorization header."),
  })
  .passthrough()
  .describe("Pre-signed upload instructions.");

export const listFilesOutputSchema = z
  .object({
    files: z.array(fileInfoSchema).describe("Files visible to the API key."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z.string().nullable().describe("Cursor for the next page, or null."),
  })
  .passthrough()
  .describe("Paginated list of files.");

export const listTtsVoicesOutputSchema = z
  .object({
    ttsVoices: z.array(ttsVoiceSchema).describe("Available text-to-speech voices."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z.string().nullable().describe("Cursor for the next page, or null."),
  })
  .passthrough()
  .describe("Paginated list of TTS voices.");

export const listLanguagesOutputSchema = z
  .object({
    languages: z.array(languageSchema).describe("Supported languages."),
  })
  .passthrough()
  .describe("Supported narration and caption languages.");

const entityReferenceSchema = z
  .object({
    fileId: z.string().describe("Reference image file id (vg_file_...)."),
    description: z.string().describe("Reference description (empty when unset)."),
    isDefault: z.boolean().describe("True when this is the primary/thumbnail reference."),
  })
  .passthrough()
  .describe("An image reference attached to an entity.");

const entityActorConfigSchema = z
  .object({
    voiceDisplayName: z.string().nullish().describe("Configured voice display name when set."),
    hasVoice: z.boolean().describe("True when the actor has a configured voice."),
    hasAvatarPresenter: z
      .boolean()
      .describe("True when the actor has an image reference usable for avatar generation."),
  })
  .passthrough()
  .nullable()
  .describe("Voice/avatar summary for ACTOR entities; null for other types.");

const entitySchema = z
  .object({
    entityId: z.string().describe("Entity id (vg_enti_...)."),
    entityType: z
      .enum(["ACTOR", "PRODUCT", "VISUAL_STYLE", "SLIDESHOW_THEME"])
      .describe("ACTOR, PRODUCT, VISUAL_STYLE, or SLIDESHOW_THEME."),
    name: z.string().describe("Display name."),
    description: z.string().describe("Description (empty when unset)."),
    actorConfig: entityActorConfigSchema.optional(),
    references: z.array(entityReferenceSchema).describe("Attached reference images."),
    createdAt: z.number().describe("Unix created-at timestamp."),
    updatedAt: z.number().describe("Unix updated-at timestamp."),
    isBuiltIn: z
      .boolean()
      .optional()
      .describe("True for VideoGen catalog entities that cannot be modified."),
  })
  .passthrough()
  .describe("A reusable actor, product, visual style, or slideshow theme entity.");

export const entityOutputSchema = entitySchema;

export const listEntitiesOutputSchema = z
  .object({
    entities: z.array(entitySchema).describe("Entities visible to the API key."),
    hasMore: z.boolean().describe("Whether another page is available."),
    nextCursor: z.string().nullable().describe("Cursor for the next page, or null."),
  })
  .passthrough()
  .describe("Paginated list of entities.");

export const entityArchiveOutputSchema = z
  .object({
    entityId: z.string().describe("Archived entity id."),
    archived: z.boolean().describe("Always true on success."),
  })
  .passthrough()
  .describe("Entity archive confirmation.");

export const openUploaderOutputSchema = z
  .object({
    status: z.string().describe("Widget status (ready when the uploader UI can open)."),
  })
  .passthrough()
  .describe("ChatGPT App upload-widget launch result.");

export const guidanceDocumentOutputSchema = z
  .object({
    markdown: z.string().describe("Full guidance document in markdown."),
  })
  .passthrough()
  .describe("Operational guidance document for agents.");

export const getAppDeepLinkOutputSchema = z
  .object({
    url: z
      .string()
      .describe(
        "Absolute URL to open in a browser. After VideoGen sign-in, the app applies the action (modal or navigation).",
      ),
    action: z.string().describe("The deep-link action that was resolved."),
  })
  .passthrough()
  .describe("VideoGen app deep link for an assistant COMMON action.");
