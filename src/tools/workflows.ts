import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  toPromptToVideoClipRequest,
  toScriptToVideoRequest,
  toSlideshowToVideoRequest,
  toStoryboardToVideoRequest,
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
  voiceoverToVideoInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import {
  listWorkflowRunsOutputSchema,
  workflowRunOutputSchema,
} from "../outputSchemas";
import {
  DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
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
        "Build an editable narrated video from an uploaded PDF or slideshow file. Upload the file first with upload_file, then pass its fileId. For avatar narration, pass actorEntityId and optionally set avatarQuality.",
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
        "Build an editable video from an ordered storyboard (frame-by-frame shot list). Every scene needs a visual prompt and may include spoken words. Much more credit-heavy than script_to_video: use at most 3 scenes unless the user explicitly asks for more. Prefer script_to_video for ~1 minute+ narrated / informational videos. If the user has not named a workflow, ask with pros/cons before calling this.",
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
        "Generate one short AI video clip from a prompt inside an editable project.",
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
    "list_workflow_runs",
    {
      title: "List workflow runs",
      description: "List workflow runs, most recent first.",
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
      description: "Fetch the current status and result of a single workflow run.",
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
      description: "Request cancellation of an in-progress workflow run.",
      inputSchema: cancelWorkflowRunInputSchema,
      outputSchema: workflowRunOutputSchema,
      annotations: DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.cancelWorkflowRun({ workflowRunId: args.workflowRunId }),
      ),
  );
}
