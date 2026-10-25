import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  toPromptToVideoClipRequest,
  toScriptToVideoRequest,
  toSlideshowToVideoRequest,
  toStoryboardToVideoRequest,
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
        "Preferred for narrated / informational / explainer videos from text, especially ~1 minute or longer. Turn a verbatim narration script into an editable video with AI-generated visuals and captions. Prefer this over storyboard_to_video unless the user wants a short shot-directed storyboard. For avatar narration, pass actorEntityId and optionally set avatarQuality.",
      inputSchema: scriptToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().workflows.scriptToVideo(toScriptToVideoRequest(args)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "voiceover_to_video",
    {
      title: "Voiceover to video",
      description:
        "Build an editable video with AI-generated visuals from an uploaded voiceover audio file.",
      inputSchema: voiceoverToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().workflows.voiceoverToVideo(toVoiceoverToVideoRequest(args)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "slideshow_to_video",
    {
      title: "Slideshow to video",
      description:
        "Build an editable narrated video from an uploaded PDF or slideshow file. Upload the file first with upload_file, then pass its fileId. For avatar narration, pass actorEntityId and optionally set avatarQuality. Returns workflowRunId, projectId, and projectUrl; poll get_workflow_run for progress and downloadUrl after auto-export.",
      inputSchema: slideshowToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().workflows.slideshowToVideo(toSlideshowToVideoRequest(args)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "storyboard_to_video",
    {
      title: "Storyboard to video",
      description:
        "Build an editable video from an ordered storyboard (frame-by-frame shot list). To show a saved product, actor, or visual style, pass productEntityIds, actorEntityIds, or visualStyleEntityId on each scene that should use that entity's reference images (create_entity and add_entity_reference first). A prompt alone does not attach those images. Much more credit-heavy than script_to_video: use at most 3 scenes unless the user explicitly asks for more. Prefer script_to_video for ~1 minute+ narrated / informational videos. If the user has not named a workflow, ask with pros/cons before calling this.",
      inputSchema: storyboardToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().workflows.storyboardToVideo(toStoryboardToVideoRequest(args)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "prompt_to_video_clip",
    {
      title: "Prompt to video",
      description:
        "Generate one short AI video clip from a prompt inside a new editable project. Returns workflowRunId, projectId, and projectUrl; poll get_workflow_run for status and downloadUrl after auto-export.",
      inputSchema: promptToVideoClipInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().workflows.promptToVideoClip(toPromptToVideoClipRequest(args)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "video_to_video",
    {
      title: "Video to video",
      description:
        "Restyle an existing video from a text prompt inside an editable project, keeping its length and timing. Pass the video as videoFileId (from upload_file) or as a public videoUrl, which the run imports itself. Restyles up to 120 seconds per run.",
      inputSchema: videoToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await runComposite({
        start: () => getClient().workflows.videoToVideo(toVideoToVideoRequest(args)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: {},
      }),
  );

  server.registerTool(
    "list_workflow_runs",
    {
      title: "List workflow runs",
      description: "Return a page of workflow runs, most recent first, with run and project ids, status, progress, errors, and export URLs when available, plus nextCursor for pagination.",
      inputSchema: listWorkflowRunsInputSchema,
      outputSchema: listWorkflowRunsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().workflows.listWorkflowRuns(dropUndefined(args))),
  );

  server.registerTool(
    "get_workflow_run",
    {
      title: "Get workflow run",
      description: "Return a workflow run with status, progress, error details, projectId, projectUrl, and downloadUrl when auto-export has finished. Use this to poll an existing run without starting another project.",
      inputSchema: getWorkflowRunInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.getWorkflowRun({ workflowRunId: args.workflowRunId }),
      ),
  );

  server.registerTool(
    "cancel_workflow_run",
    {
      title: "Cancel workflow run",
      description: "Request cancellation of an API-started workflow and its related generation, remix, and export tasks. This stops pending work; it does not delete the project or undo completed work. Terminal runs are unchanged. Returns workflowRunId, projectId, projectUrl, and remixActionIds as an acknowledgment; use get_workflow_run for status.",
      inputSchema: cancelWorkflowRunInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.cancelWorkflowRun({ workflowRunId: args.workflowRunId }),
      ),
  );
}
