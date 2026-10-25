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
  videoToVideoInputSchema,
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

const projectIdField = z.string().describe("Editable project to inspect. Use projectId from a workflow result or list_projects.");

const uploadFileTypeField = z
  .enum(["IMAGE", "VIDEO", "AUDIO"])
  .optional()
  .describe("Media kind to associate with the upload. Inferred when omitted.");

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

const STANDARD_DEEP_LINK_DESTINATION_DESCRIBE =
  "Required for NAVIGATE. In-app keys like PROJECTS, BILLING_SETTINGS, SUPPORT; or HELP_CENTER / API_DOCS.";

const CHATGPT_APP_DEEP_LINK_DESTINATION_DESCRIBE =
  "Required for NAVIGATE. In-app keys like PROJECTS, TEAM, SUPPORT; or HELP_CENTER / API_DOCS. Do not use billing destinations. For credits or account access, tell the user to open https://app.videogen.io and manage their VideoGen account.";

const buildAppDeepLinkInputSchema = ({
  actions,
  destinationDescribe,
}: {
  actions: readonly [string, ...string[]];
  destinationDescribe: string;
}) => ({
  action: z
    .enum(actions)
    .describe(
      "App operation to open after sign-in, such as navigation, feedback, or integration management.",
    ),
  destination: z.string().optional().describe(destinationDescribe),
  articleSlug: z
    .string()
    .optional()
    .describe("Required for OPEN_HELP_ARTICLE. Help-center search text, such as an article title or its URL slug; the link opens matching search results."),
  provider: z
    .string()
    .optional()
    .describe(
      "Required for OPEN_MANAGE_INTEGRATION. Integration provider key, such as GOOGLE or SLACK, identifying the connection to manage.",
    ),
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
    .describe("Feedback classification for OPEN_SUBMIT_FEEDBACK. Omit or pass null to let the user choose."),
  text: z
    .string()
    .nullable()
    .optional()
    .describe("Optional for OPEN_SUBMIT_FEEDBACK. Prefills the ticket description (capped)."),
  suggestedLocale: z
    .string()
    .nullable()
    .optional()
    .describe("For OPEN_LANGUAGE_SELECTOR, preselect a UI language using an app locale code such as en or es. Unsupported codes are ignored. The user can choose another language."),
});

export const getAppDeepLinkInputSchema = buildAppDeepLinkInputSchema({
  actions: STANDARD_APP_DEEP_LINK_ACTIONS,
  destinationDescribe: STANDARD_DEEP_LINK_DESTINATION_DESCRIBE,
});

export const getChatGptAppDeepLinkInputSchema = buildAppDeepLinkInputSchema({
  actions: CHATGPT_APP_DEEP_LINK_ACTIONS,
  destinationDescribe: CHATGPT_APP_DEEP_LINK_DESTINATION_DESCRIBE,
});

export const listProjectsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getProjectInputSchema = { projectId: projectIdField };

export const getProjectExportInputSchema = {
  projectId: z.string().describe("Project that owns the export. Use the same projectId passed to export_project, obtained from a workflow result or list_projects."),
  exportId: z.string().describe("Export id (vg_expo_...) from export_project."),
};

export const listProjectRemixActionsInputSchema = { projectId: projectIdField };

export const listWorkflowRunsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getWorkflowRunInputSchema = {
  workflowRunId: z.string().describe("Run to inspect or cancel. Use workflowRunId from a workflow start result or list_workflow_runs."),
};

export const cancelWorkflowRunInputSchema = getWorkflowRunInputSchema;

export const listToolExecutionsInputSchema = {
  cursor: cursorField,
  limit: limitField,
  selfOnly: selfOnlyField,
};

export const getToolExecutionInputSchema = {
  toolExecutionId: z.string().describe("Execution to inspect or cancel. Use toolExecutionId from a media-tool start result or list_tool_executions."),
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
    .describe("Whether to include older voices that remain callable. Omit to exclude deprecated voices."),
  query: catalogueQueryField,
};

export const listLanguagesInputSchema = {
  query: catalogueQueryField,
};

const entityTypeField = z
  .enum(["ACTOR", "PRODUCT", "VISUAL_STYLE", "SLIDESHOW_THEME", "BRAND", "LOCATION", "PROP"])
  .describe(
    "ACTOR = consistent character; PRODUCT = a product the user sells or promotes; VISUAL_STYLE = look/style for generated images; SLIDESHOW_THEME = shared slide design system for a slideshow deck; BRAND = logo, style guide image, and writing style; LOCATION = consistent place or set; PROP = background object that is not a product. Anything the user sells is a PRODUCT, never a PROP.",
  );

const entityIdField = z.string().describe("Saved reference entity to use. Obtain entityId from list_entities or create_entity.");

const entityBrandConfigField = z.object({
  fonts: z.string().describe("Font guidance for a BRAND entity."),
  colors: z.string().describe("Color guidance, including hex codes when available."),
  writingStyle: z.string().describe("Voice and tone for spoken and on-screen copy."),
});

export const listEntitiesInputSchema = {
  entityType: entityTypeField.optional().describe("When set, only return entities of this type."),
  cursor: cursorField,
  limit: limitField,
};

export const createEntityInputSchema = {
  entityType: entityTypeField,
  name: z.string().min(1).describe("Display name for the entity."),
  description: z.string().optional().describe("Describe the subject, product, setting, or visual identity this saved entity represents."),
  brandConfig: entityBrandConfigField.optional().describe("Configuration for a BRAND entity."),
};

export const getEntityInputSchema = {
  entityId: entityIdField,
};

export const updateEntityInputSchema = {
  entityId: entityIdField,
  name: z.string().min(1).optional().describe("New display name. Omit to leave unchanged."),
  description: z.string().optional().describe("New description. Omit to leave unchanged."),
  brandConfig: entityBrandConfigField
    .optional()
    .describe("Complete replacement configuration for a BRAND entity."),
};

export const archiveEntityInputSchema = {
  entityId: entityIdField,
};

export const addEntityReferenceInputSchema = {
  entityId: entityIdField,
  fileId: z
    .string()
    .describe(
      "Image file id (vg_file_...) to attach as a reference. Upload first via upload_file / create_file_upload / open_uploader.",
    ),
  description: z.string().optional().describe("Optional description of this reference image."),
  role: z
    .enum(["REFERENCE", "BRAND_LOGO", "BRAND_STYLE_GUIDE"])
    .optional()
    .describe(
      "Purpose of the attached file. Omit for a general reference. On a BRAND, BRAND_LOGO is its overlay logo and BRAND_STYLE_GUIDE is its visual generation reference.",
    ),
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
    .describe("Human-readable label used to identify the uploaded asset in the VideoGen library. Defaults to the source file name."),
  type: uploadFileTypeField,
};

export const uploadFileHostedInputSchema = {
  fileData: z.string().describe("Base64-encoded contents of the file to upload."),
  displayName: z.string().optional().describe("Human-readable label used to identify the uploaded asset in the VideoGen library. Defaults to 'upload'."),
  type: uploadFileTypeField,
};

export const createFileUploadInputSchema = {
  displayName: z.string().describe("Human-readable label used to identify the uploaded asset in the VideoGen library."),
  type: z
    .enum(["IMAGE", "VIDEO", "AUDIO", "PDF", "SLIDESHOW"])
    .optional()
    .describe("Media or document kind to associate with the upload. Inferred after processing when omitted."),
  isTemporary: z
    .boolean()
    .optional()
    .describe(
      "When true, the file is temporary (guaranteed available for 24 hours, not analyzed for search). Defaults to false.",
    ),
};

export const getFileInputSchema = {
  fileId: z.string().describe("Asset to fetch. Use fileId from upload_file, create_file_upload, list_files, or a generation result."),
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
    .describe("Time between readiness checks in milliseconds when wait is true. Omit to poll every 3000 milliseconds."),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum time to wait for processing before giving up, in milliseconds."),
};

export const listFilesInputSchema = { cursor: cursorField, limit: limitField };

export const openUploaderInputSchema = emptyInputSchema;

/**
 * One ChatGPT attachment, as passed when a tool lists the field in
 * `_meta["openai/fileParams"]`. `download_url` and `file_id` are required;
 * `mime_type` and `file_name` must be declared and must stay optional or the
 * plugin scan rejects the tool. Unknown keys are rejected because the scan
 * requires `additionalProperties: false` on this object.
 */
export const chatgptAttachmentFileSchema = z.strictObject({
  download_url: z.string().describe("Temporary download URL ChatGPT provides for this attachment."),
  file_id: z.string().describe("ChatGPT file id for this attachment."),
  mime_type: z.string().optional().describe("MIME type when ChatGPT provides one."),
  file_name: z.string().optional().describe("File name when ChatGPT provides one."),
});

export const openUploaderChatgptInputSchema = {
  files: z
    .array(chatgptAttachmentFileSchema)
    .optional()
    .describe(
      "Photos or files the user attached in this chat. Pass every attachment. Omit this when nothing is attached yet and the user should pick the files in the uploader.",
    ),
};
