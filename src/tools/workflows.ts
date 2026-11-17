import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  toPromptToVideoClipRequest,
  toScriptToVideoRequest,
  toSlideshowToVideoRequest,
  toStoryboardToVideoRequest,
  toTranslateVideoRequest,
  toVideoToVideoRequest,
  toVoiceoverToVideoRequest,
} from "../adapters/workflowAdapters";
import type { GetVideoGenClient } from "../client";
import {
  cancelWorkflowRunInputSchema,
  getWorkflowRunInputSchema,
  listWorkflowRunsInputSchema,
  promptToVideoClipInputSchema,
  scriptToVideoInputSchema,
  slideshowToVideoInputSchema,
  storyboardToVideoInputSchema,
  translateVideoInputSchema,
  videoToVideoInputSchema,
  voiceoverToVideoInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import {
  listWorkflowRunsOutputSchema,
  workflowRunOutputSchema,
} from "../outputSchemas";
import {
  IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PRIVATE_TOOL_ANNOTATIONS,
  WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

export function registerWorkflowTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
): void {
  server.registerTool(
    "script_to_video",
    {
      title: "Script to video",
      description:
        "Use for script to video: turn a verbatim narration script into an editable video with AI visuals and captions. Fits narrated product demos, marketing explainers, training, and lessons, especially around a minute or longer. Prefer storyboard_to_video for short product ads requiring control over each shot. For avatar narration, pass actorEntityId and optionally avatarQuality. Creates a new project and uses team credits. Returns workflowRunId, projectId, and projectUrl; poll get_workflow_run for progress and downloadUrl after auto-export.",
      inputSchema: scriptToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.scriptToVideo(toScriptToVideoRequest(args)),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "voiceover_to_video",
    {
      title: "Voiceover to video",
      description:
        "Use when the user already has a recorded voiceover and wants a finished video around that audio. Build an editable video with AI visuals and captions from the uploaded audio file. Fits recorded product pitches, explainers, and training narration. Use script_to_video when the source is written narration rather than audio. Creates a new project and uses team credits. Poll get_workflow_run for progress and downloadUrl after auto-export.",
      inputSchema: voiceoverToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.voiceoverToVideo(
            toVoiceoverToVideoRequest(args),
          ),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "slideshow_to_video",
    {
      title: "Slideshow to video",
      description:
        "Use when an existing PDF or slide deck should become an editable narrated video, such as a product overview, sales presentation, or training lesson. Upload the file first and pass its fileId; this converts supplied slides rather than creating a slide deck. For avatar narration, pass actorEntityId and optionally avatarQuality. Creates a new project and uses team credits. Returns workflowRunId, projectId, and projectUrl; poll get_workflow_run for progress and downloadUrl after auto-export.",
      inputSchema: slideshowToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.slideshowToVideo(
            toSlideshowToVideoRequest(args),
          ),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "storyboard_to_video",
    {
      title: "Storyboard to video",
      description:
        "Use for AI video ads, UGC-style product ads, ecommerce product videos, consumer-app launches, or cinematic scenes that need control over each shot. Turn an ordered storyboard into a new editable video project. For product photos, actors, or visual styles, pass productEntityIds, actorEntityIds, or visualStyleEntityId on every scene needing those references (create_entity and add_entity_reference first). Prompt text alone does not attach images; references guide generation without guaranteeing exact reproduction. Uses more team credits than script_to_video: use at most 3 scenes unless the user explicitly requests more. Prefer script_to_video for longer narrated explainers. If no workflow has been selected, explain the tradeoffs and ask before starting. Poll get_workflow_run for progress and downloadUrl after auto-export.",
      inputSchema: storyboardToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.storyboardToVideo(
            toStoryboardToVideoRequest(args),
          ),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "prompt_to_video_clip",
    {
      title: "Prompt to video",
      description:
        "Use for text to video when the user wants one short AI-generated shot in a new editable project, such as a product teaser or background clip. Use storyboard_to_video for a sequence of planned shots, or generate_video_clip for a standalone media file without a project. Creates a new project and uses team credits. Returns workflowRunId, projectId, and projectUrl; poll get_workflow_run for status and downloadUrl after auto-export.",
      inputSchema: promptToVideoClipInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.promptToVideoClip(
            toPromptToVideoClipRequest(args),
          ),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "video_to_video",
    {
      title: "Video to video",
      description:
        "Use when the user wants to restyle existing footage from a text prompt while keeping its length and timing. Creates an editable project and uses team credits. Pass videoFileId from an upload or a public videoUrl, which the run imports itself. Restyles up to 120 seconds per run. For captions, transitions, or other supported edits to an existing VideoGen project, use start_video_edits instead. This changes the footage's visual treatment; it does not publish or manage an ad campaign. For external links, prefer import_video_from_url and get_video_url_import first; ask the user to choose any returned selection, then pass its successful fileId as videoFileId. Do not start generation before resolving a multi-video choice.",
      inputSchema: videoToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.videoToVideo(toVideoToVideoRequest(args)),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "translate_video",
    {
      title: "Translate video",
      description:
        "Use when the user wants an existing video's speech translated into one or more other languages, keeping the original voices and timing. Upload the video first and pass its videoFileId. Each output language becomes its own editable video in one new project; get_workflow_run returns them in outputs with an editableVideoId per language, and a language that fails does not fail the others. Auto-export renders the first successful language; call export_project with editableVideoId for the others. Uses team credits per minute of video and language.",
      inputSchema: translateVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () =>
          getClient().workflows.translateVideo(toTranslateVideoRequest(args)),
        poll: (workflowRunId) =>
          getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "list_workflow_runs",
    {
      title: "List workflow runs",
      description:
        "Return a page of workflow runs, most recent first, with run and project ids, status, progress, errors, and export URLs when available, plus nextCursor for pagination.",
      inputSchema: listWorkflowRunsInputSchema,
      outputSchema: listWorkflowRunsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.listWorkflowRuns(dropUndefined(args)),
      ),
  );

  server.registerTool(
    "get_workflow_run",
    {
      title: "Get workflow run",
      description:
        "Return a workflow run with status, progress, error details, projectId, projectUrl, and downloadUrl when auto-export has finished. Use this to poll an existing run without starting another project.",
      inputSchema: getWorkflowRunInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.getWorkflowRun({
          workflowRunId: args.workflowRunId,
        }),
      ),
  );

  server.registerTool(
    "cancel_workflow_run",
    {
      title: "Cancel workflow run",
      description:
        "Request cancellation of an API-started workflow and its related generation, edit, and export tasks. This stops pending work; it does not delete the project or undo completed work. Terminal runs are unchanged. Returns workflowRunId, projectId, projectUrl, and videoEditIds as an acknowledgment; use get_workflow_run for status.",
      inputSchema: cancelWorkflowRunInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.cancelWorkflowRun({
          workflowRunId: args.workflowRunId,
        }),
      ),
  );
}
