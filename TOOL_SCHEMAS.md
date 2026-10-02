# VideoGen MCP tools and JSON schemas

This reference documents 50 callable tools, including complete input and output JSON schemas in [tool-schemas.json](./tool-schemas.json). Each descriptor includes its name, description, required fields, annotations, and authentication declaration.

The snapshot was retrieved from the live hosted `https://mcp.videogen.io/mcp/chatgpt` endpoint on October 2, 2026 using MCP `tools/list`. It contains public tool definitions only. No tool was invoked and no account data or credentials are included.

For current definitions, send `tools/list` to your connected server. The standard hosted endpoint is `https://mcp.videogen.io/mcp` and requires OAuth or a VideoGen API key. The ChatGPT endpoint permits unauthenticated discovery; protected tools still require authorization when called. Local stdio tool schemas can differ for file uploads and hosted widgets.

Setup: [VideoGen MCP](https://videogen.io/videogen-mcp). Developer reference: [MCP documentation](https://docs.videogen.io/libraries/mcp).

## Discovery request

```json
{"jsonrpc":"2.0","id":"tools-reference","method":"tools/list","params":{}}
```

## Callable tools

All inputs and outputs are JSON objects. “None” means no input properties are required; optional properties remain documented in the JSON schema. Returned properties can vary by operation status and the schema defines their precise constraints.

| Tool | Required input properties | Output properties |
| --- | --- | --- |
| [`add_entity_reference`](#add_entity_reference) | `entityId`, `fileId` | `entityId`, `entityType`, `name`, `description`, `actorConfig`, `references`, `createdAt`, `updatedAt`, `isBuiltIn` |
| [`archive_entity`](#archive_entity) | `entityId` | `entityId`, `archived` |
| [`cancel_tool_execution`](#cancel_tool_execution) | `toolExecutionId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`cancel_workflow_run`](#cancel_workflow_run) | `workflowRunId` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |
| [`create_entity`](#create_entity) | `entityType`, `name` | `entityId`, `entityType`, `name`, `description`, `actorConfig`, `references`, `createdAt`, `updatedAt`, `isBuiltIn` |
| [`create_file_upload`](#create_file_upload) | `displayName` | `fileId`, `uploadUrl` |
| [`export_project`](#export_project) | `projectId` | `exportId`, `projectId`, `status`, `progressPercentage`, `attemptIndex`, `downloadUrl`, `downloadUrlExpiresAt`, `thumbnailUrl`, `thumbnailUrlExpiresAt`, `exportFileId`, `file`, `error` |
| [`generate_avatar`](#generate_avatar) | `actorEntityId`, `audioFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`generate_image`](#generate_image) | `prompt` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`generate_motion_graphic`](#generate_motion_graphic) | `prompt` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`generate_music`](#generate_music) | `prompt` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`generate_sound_effect`](#generate_sound_effect) | `prompt` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`generate_video_clip`](#generate_video_clip) | None | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`get_app_deep_link`](#get_app_deep_link) | `action` | `url`, `action` |
| [`get_async_tasks_guidance`](#get_async_tasks_guidance) | None | `markdown` |
| [`get_entity`](#get_entity) | `entityId` | `entityId`, `entityType`, `name`, `description`, `actorConfig`, `references`, `createdAt`, `updatedAt`, `isBuiltIn` |
| [`get_file`](#get_file) | `fileId` | `fileId`, `type`, `scope`, `displayName`, `description`, `durationSeconds`, `transcriptText`, `downloadUrl`, `downloadUrlExpiresAt`, `thumbnailUrl`, `thumbnailUrlExpiresAt`, `thumbnailSource`, `previewSource`, `downloadSource`, `hlsSource`, `isPublicPreviewEnabled`, `publicHlsUrl`, `publicPlaybackId`, `sourceToolType`, `sourceToolExecutionId` |
| [`get_getting_started_guidance`](#get_getting_started_guidance) | None | `markdown` |
| [`get_me`](#get_me) | None | `apiKeyId`, `apiKeyNickname`, `email`, `displayName`, `teamId` |
| [`get_project`](#get_project) | `projectId` | `projectId`, `assistantId`, `title`, `status`, `projectUrl`, `createdAt`, `updatedAt`, `aspectRatio` |
| [`get_project_export`](#get_project_export) | `projectId`, `exportId` | `exportId`, `projectId`, `status`, `progressPercentage`, `attemptIndex`, `downloadUrl`, `downloadUrlExpiresAt`, `thumbnailUrl`, `thumbnailUrlExpiresAt`, `exportFileId`, `file`, `error` |
| [`get_tool_execution`](#get_tool_execution) | `toolExecutionId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`get_tools_vs_workflows_guidance`](#get_tools_vs_workflows_guidance) | None | `markdown` |
| [`get_workflow_run`](#get_workflow_run) | `workflowRunId` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |
| [`get_workflows_guidance`](#get_workflows_guidance) | None | `markdown` |
| [`image_3d_effect`](#image_3d_effect) | `imageFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`list_entities`](#list_entities) | None | `entities`, `hasMore`, `nextCursor` |
| [`list_files`](#list_files) | None | `files`, `hasMore`, `nextCursor` |
| [`list_languages`](#list_languages) | None | `languages` |
| [`list_project_remix_actions`](#list_project_remix_actions) | `projectId` | `remixActions`, `hasMore`, `nextCursor` |
| [`list_projects`](#list_projects) | None | `projects`, `hasMore`, `nextCursor` |
| [`list_tool_executions`](#list_tool_executions) | None | `toolExecutions`, `hasMore`, `nextCursor` |
| [`list_tts_voices`](#list_tts_voices) | None | `ttsVoices`, `hasMore`, `nextCursor` |
| [`list_workflow_runs`](#list_workflow_runs) | None | `workflowRuns`, `hasMore`, `nextCursor` |
| [`open_uploader`](#open_uploader) | None | `status` |
| [`prompt_to_video_clip`](#prompt_to_video_clip) | `prompt` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |
| [`remix_project`](#remix_project) | `projectId`, `edits` | `projectId`, `projectUrl`, `remixActionIds` |
| [`remove_entity_reference`](#remove_entity_reference) | `entityId`, `fileId` | `entityId`, `entityType`, `name`, `description`, `actorConfig`, `references`, `createdAt`, `updatedAt`, `isBuiltIn` |
| [`remove_image_background`](#remove_image_background) | `imageFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`remove_video_background`](#remove_video_background) | `videoFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`script_to_video`](#script_to_video) | `script` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |
| [`slideshow_to_video`](#slideshow_to_video) | `fileId` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |
| [`storyboard_to_video`](#storyboard_to_video) | `scenes` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |
| [`text_to_speech`](#text_to_speech) | `text`, `voiceId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`update_entity`](#update_entity) | `entityId` | `entityId`, `entityType`, `name`, `description`, `actorConfig`, `references`, `createdAt`, `updatedAt`, `isBuiltIn` |
| [`upload_file`](#upload_file) | `fileData` | `fileId`, `type`, `scope`, `displayName`, `description`, `durationSeconds`, `transcriptText`, `downloadUrl`, `downloadUrlExpiresAt`, `thumbnailUrl`, `thumbnailUrlExpiresAt`, `thumbnailSource`, `previewSource`, `downloadSource`, `hlsSource`, `isPublicPreviewEnabled`, `publicHlsUrl`, `publicPlaybackId`, `sourceToolType`, `sourceToolExecutionId` |
| [`upscale_image`](#upscale_image) | `imageFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`upscale_video`](#upscale_video) | `videoFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`vectorize_image`](#vectorize_image) | `imageFileId` | `toolExecutionId`, `status`, `toolType`, `progressPercentage`, `attemptIndex`, `results`, `error` |
| [`voiceover_to_video`](#voiceover_to_video) | `fileId` | `workflowRunId`, `projectId`, `projectUrl`, `remixActionIds`, `status`, `workflowType`, `progressPercentage`, `attemptIndex`, `error`, `exportId`, `downloadUrl`, `downloadUrlExpiresAt`, `exportFileId` |

## Tool descriptions

### add_entity_reference

Attach an uploaded file (vg_file_...) as a reference on an entity. Images work for every entity type. Slideshow themes may also attach a PDF or PowerPoint. Built-in entities cannot have references added. For new PRODUCT/ACTOR entities, call this right after create_entity with isDefault: true so the entity has a usable thumbnail and generation reference.

### archive_entity

Archive an entity so it no longer appears in lists or pickers. Built-in entities cannot be archived.

### cancel_tool_execution

Request cancellation of an in-progress tool execution.

### cancel_workflow_run

Request cancellation of an in-progress workflow run.

### create_entity

Create an ACTOR (character), PRODUCT (product/object), VISUAL_STYLE, or SLIDESHOW_THEME entity. After create, attach at least one reference with add_entity_reference (upload the file first). Slideshow themes may attach an image or a PDF / PowerPoint. Use the returned entityId as actorEntityId on generate_avatar / script_to_video, a product/style reference in storyboard scenes, or slideshowThemeEntityId on slideshow_to_video.

### create_file_upload

Start an upload for a large file, or when file bytes cannot be inlined. Returns { fileId, uploadUrl }. PUT the raw file bytes to uploadUrl with NO Authorization header (it is a short-lived pre-signed URL). Then call get_file with { fileId, wait: true } to wait until processing finishes, and pass the returned fileId to workflows, tools, logos, or B-roll. For small files, prefer upload_file.

### export_project

Export a project to an MP4 and return its status or download URL. Renders often take a few minutes. Tell the user that wait up front.

### generate_avatar

Generate a talking-head avatar video from an ACTOR entity and an uploaded audio file. Pass actorEntityId and optionally set avatarQuality. Typically takes a few minutes (longer for longer audio). Tell the user that wait up front.

### generate_image

Generate an image from a text prompt, optionally conditioned on source images (image-to-image) and actor, product, or visual-style entity ids. Typically takes 15–60 seconds. Tell the user that wait up front.

### generate_motion_graphic

Generate an animated motion graphic video from a text prompt. Best for precise text animations (typing effects, kinetic typography, lower thirds) that stock or generated footage can't express. Outputs a transparent WebM overlay by default; set transparentBackground to false for an opaque MP4. Optionally pass reference media file ids to display or animate. Typically takes 2–5 minutes because VideoGen writes animation code and then renders it; complex prompts can take longer. Tell the user that wait before starting and keep polling calmly — a healthy in-progress job is expected.

### generate_music

Generate a music track from a text prompt. Typically takes 1–5 minutes depending on track length. Tell the user that wait up front.

### generate_sound_effect

Generate a sound effect from a text prompt.

### generate_video_clip

Generate a video clip from a text prompt, source images, source videos, spokenDialogue, or reference audio. quality is optional (LOW, STANDARD, HIGH, or MAX). Typically takes 1–3 minutes (HIGH/MAX can be longer). Tell the user that wait up front and keep polling calmly.

### get_app_deep_link

Build a VideoGen app URL that opens a non-billing modal or navigates after the user signs in (invite teammates, submit feedback, integrations, account settings, or a NAVIGATE destination). Prefer this when the user needs to complete something in the VideoGen UI that MCP tools cannot do inline. For credits or plan access issues, do not use this tool: tell the user to open https://app.videogen.io and manage their VideoGen account. Return the url to the user so they can open it.

### get_async_tasks_guidance

How to handle async workflows, tool executions, and exports: statuses, hosted vs local wait caps, polling with get_* tools, and when webhooks apply outside MCP. Call before polling or when a start tool returns a still-running snapshot. Equivalent to reading the `guidance://async-tasks` MCP resource — provided as a tool for clients that don't read resources directly.

### get_entity

Fetch one entity by id, including its reference images. Built-in catalog entities are included and have isBuiltIn true.

### get_file

Fetch a file by id with freshly hydrated (non-expired) signed URLs for its thumbnail, preview, and download renditions. Set wait: true to poll until the file finishes processing — use this right after PUTting bytes to a create_file_upload URL.

### get_getting_started_guidance

How to authenticate, verify with get_me, introduce VideoGen with workflow example prompts, choose workflows vs media tools, and follow VideoGen id conventions. Call when connecting, onboarding, the user asks what VideoGen can do, or how to set up the API or MCP. Equivalent to reading the `guidance://getting-started` MCP resource — provided as a tool for clients that don't read resources directly.

### get_me

Fetch the account and team behind the API key (`apiKeyId`, `apiKeyNickname`, `email`, `displayName`, `teamId`). Use it as a connection test.

### get_project

Fetch metadata and the shareable URL for a single project.

### get_project_export

Fetch the current status of a project export. Poll until status is succeeded, failed, or cancelled.

### get_tool_execution

Fetch the current status and results of a single tool execution.

### get_tools_vs_workflows_guidance

When to use standalone media tools (automatic model routing for a single asset) versus workflows (full editable professional video). Call when choosing between generate_* tools and workflow tools. Equivalent to reading the `guidance://tools-vs-workflows` MCP resource — provided as a tool for clients that don't read resources directly.

### get_workflow_run

Fetch the current status and result of a single workflow run.

### get_workflows_guidance

Canonical run → remix → export flow and when to use each workflow tool. Prefer script_to_video for longer narrated / informational videos; keep storyboard_to_video to ≤3 scenes unless the user asks for more. Call before starting a full video project. Equivalent to reading the `guidance://workflows` MCP resource — provided as a tool for clients that don't read resources directly.

### image_3d_effect

Add 3D parallax motion to a still image, producing a video.

### list_entities

List built-in actors, products, visual styles, and slideshow themes plus team entities. Built-in rows have isBuiltIn true and cannot be updated or archived. Filter with entityType when you only need one kind.

### list_files

List files visible to the current API key.

### list_languages

List supported languages for narration and captions.

### list_project_remix_actions

List the status of remix actions applied to a project.

### list_projects

List projects. API-created projects only by default; pass includeUiProjects to also include dashboard projects.

### list_tool_executions

List past tool executions, most recent first.

### list_tts_voices

List available text-to-speech voices for narration, text_to_speech, and workflows.

### list_workflow_runs

List workflow runs, most recent first.

### open_uploader

Open an in-chat file uploader (ChatGPT only). The user picks a file, it is uploaded to VideoGen, and its file id (vg_file_...) is reported back for use in voiceover_to_video, slideshow_to_video, logos, or B-roll. Prefer this over asking the user to paste a link. On clients without in-chat UI, use upload_file (small files) or create_file_upload (large files) instead.

### prompt_to_video_clip

Generate one short AI video clip from a prompt inside an editable project.

### remix_project

Apply curated edits to an existing project. CONVERT_IMAGES_TO_VIDEOS generates AI video clips from every still and is expensive. Use ZOOM for cheap Ken Burns camera motion. Poll with list_project_remix_actions for status.

### remove_entity_reference

Detach a reference image from an entity by file id. Built-in entities cannot have references removed.

### remove_image_background

Remove the background from an image.

### remove_video_background

Remove the background from a video.

### script_to_video

Preferred for narrated / informational / explainer videos from text, especially ~1 minute or longer. Turn a verbatim narration script into an editable video with AI-generated visuals and captions. Prefer this over storyboard_to_video unless the user wants a short shot-directed storyboard. For avatar narration, pass actorEntityId and optionally set avatarQuality.

### slideshow_to_video

Build an editable narrated video from an uploaded PDF or slideshow file. Upload the file first with upload_file, then pass its fileId. For avatar narration, pass actorEntityId and optionally set avatarQuality.

### storyboard_to_video

Build an editable video from an ordered storyboard (frame-by-frame shot list). Every scene needs a visual prompt and may include spoken words. Much more credit-heavy than script_to_video: use at most 3 scenes unless the user explicitly asks for more. Prefer script_to_video for ~1 minute+ narrated / informational videos. If the user has not named a workflow, ask with pros/cons before calling this.

### text_to_speech

Convert text into spoken audio using a selectable voice.

### update_entity

Update an entity's display name and/or description. Built-in entities cannot be updated.

### upload_file

Upload a small file (image, logo, or short audio) to VideoGen by passing its base64-encoded contents, and wait until it is processed. Returns the file with its id (vg_file_...) and signed URLs. Use the returned fileId for voiceover_to_video, slideshow_to_video, logos, or B-roll. For large files, use create_file_upload instead.

### upscale_image

Increase the resolution of an image.

### upscale_video

Increase the resolution of a video.

### vectorize_image

Convert a raster image into a vector (SVG).

### voiceover_to_video

Build an editable video with AI-generated visuals from an uploaded voiceover audio file.
