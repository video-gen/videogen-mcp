import { z } from "zod";
export {
  exportProjectInputSchema,
  generateAvatarInputSchema,
  generateImageInputSchema,
  generateMotionGraphicInputSchema,
  generateMusicInputSchema,
  generateSoundEffectInputSchema,
  generateVideoClipInputSchema,
  image3dEffectInputSchema,
  promptToVideoClipInputSchema,
  remixProjectInputSchema,
  removeImageBackgroundInputSchema,
  removeVideoBackgroundInputSchema,
  scriptToVideoInputSchema,
  slideshowToVideoInputSchema,
  storyboardToVideoInputSchema,
  textToSpeechInputSchema,
  upscaleImageInputSchema,
  upscaleVideoInputSchema,
  vectorizeImageInputSchema,
  voiceoverToVideoInputSchema,
} from "./adapters/creativeToolContracts";

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

export const aspectRatioSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

const projectIdField = z.string().describe("Project id.");

const uploadFileTypeField = z
  .enum(["IMAGE", "VIDEO", "AUDIO"])
  .optional()
  .describe("File type. Inferred when omitted.");

export const emptyInputSchema = {};

export const getMeInputSchema = emptyInputSchema;

/**
 * Deep-link actions available on STANDARD MCP (`/mcp`, stdio). Includes commerce
 * actions so agents can walk users into upgrade / buy-credits / enable-top-ups.
 */
export const STANDARD_APP_DEEP_LINK_ACTIONS = [
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
] as const;

/**
 * Deep-link actions on ChatGPT Apps (`/mcp/chatgpt`). Commerce / purchase
 * actions are omitted for Plugins directory digital-goods policy.
 * See `mcp/src/hostSurface.ts` and `.cursor/rules/chatgpt-mcp-no-commerce.mdc`.
 */
export const CHATGPT_APP_DEEP_LINK_ACTIONS = [
  "OPEN_INVITE_TEAMMATES",
  "OPEN_SUBMIT_FEEDBACK",
  "OPEN_HELP_ARTICLE",
  "OPEN_MANAGE_INTEGRATION",
  "OPEN_INTEGRATIONS_PICKER",
  "OPEN_LANGUAGE_SELECTOR",
  "NAVIGATE",
] as const;

const buildAppDeepLinkInputSchema = ({
  actions,
}: {
  actions: readonly [string, ...string[]];
}) => ({
  action: z
    .enum(actions)
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
});

export const getAppDeepLinkInputSchema = buildAppDeepLinkInputSchema({
  actions: STANDARD_APP_DEEP_LINK_ACTIONS,
});

export const getChatGptAppDeepLinkInputSchema = buildAppDeepLinkInputSchema({
  actions: CHATGPT_APP_DEEP_LINK_ACTIONS,
});

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

export const listProjectRemixActionsInputSchema = { projectId: projectIdField };

export const listWorkflowRunsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getWorkflowRunInputSchema = {
  workflowRunId: z.string().describe("Workflow run id (vg_work_...)."),
};

export const cancelWorkflowRunInputSchema = getWorkflowRunInputSchema;

export const listToolExecutionsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getToolExecutionInputSchema = {
  toolExecutionId: z.string().describe("Tool execution id (vg_tool_...)."),
};

export const cancelToolExecutionInputSchema = getToolExecutionInputSchema;

const catalogueQueryField = z
  .string()
  .optional()
  .describe(
    "Optional case-insensitive substring filter across each item's searchable text fields.",
  );

export const listTtsVoicesInputSchema = {
  cursor: cursorField,
  limit: limitField,
  includeDeprecatedVoices: z
    .boolean()
    .optional()
    .describe("Include deprecated voices in the results."),
  query: catalogueQueryField,
};

export const listLanguagesInputSchema = {
  query: catalogueQueryField,
};

const entityTypeField = z
  .enum(["ACTOR", "PRODUCT", "VISUAL_STYLE", "SLIDESHOW_THEME"])
  .describe(
    "ACTOR = consistent character; PRODUCT = product/object; VISUAL_STYLE = look/style for generated images; SLIDESHOW_THEME = shared slide design system for a slideshow deck.",
  );

const entityIdField = z.string().describe("Entity id (vg_enti_...).");

export const listEntitiesInputSchema = {
  entityType: entityTypeField.optional().describe("When set, only return entities of this type."),
  cursor: cursorField,
  limit: limitField,
};

export const createEntityInputSchema = {
  entityType: entityTypeField,
  name: z.string().min(1).describe("Display name for the entity."),
  description: z.string().optional().describe("Optional longer description."),
};

export const getEntityInputSchema = {
  entityId: entityIdField,
};

export const updateEntityInputSchema = {
  entityId: entityIdField,
  name: z.string().min(1).optional().describe("New display name. Omit to leave unchanged."),
  description: z.string().optional().describe("New description. Omit to leave unchanged."),
};

export const archiveEntityInputSchema = {
  entityId: entityIdField,
};

export const addEntityReferenceInputSchema = {
  entityId: entityIdField,
  fileId: z
    .string()
    .describe("Image file id (vg_file_...) to attach as a reference. Upload first via upload_file / create_file_upload / open_uploader."),
  description: z.string().optional().describe("Optional description of this reference image."),
  isDefault: z
    .boolean()
    .optional()
    .describe("When true, make this the primary reference (thumbnail). Defaults to false."),
};

export const removeEntityReferenceInputSchema = {
  entityId: entityIdField,
  fileId: z.string().describe("Reference image file id (vg_file_...) to remove."),
};

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
