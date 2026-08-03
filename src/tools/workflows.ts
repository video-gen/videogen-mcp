import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import {
  listWorkflowRunsOutputSchema,
  workflowRunOutputSchema,
} from "../outputSchemas";

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
        "Turn a script into a finished narrated video with visuals and captions. The script is narrated verbatim (not rewritten). Starts the workflow and, by default, waits for the finished render. Provide at least two remixActions (e.g. ENABLE_CAPTIONS + SET_BACKGROUND_MUSIC) for a polished result.",
      inputSchema: scriptToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().workflows.scriptToVideo(dropUndefined(rest)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "voiceover_to_video",
    {
      title: "Voiceover to video",
      description:
        "Build a narrated video from an already-uploaded voiceover audio file. Upload the audio first with upload_file, then pass its fileId. Starts the workflow and, by default, waits for the finished render.",
      inputSchema: voiceoverToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().workflows.voiceoverToVideo(dropUndefined(rest)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "slideshow_to_video",
    {
      title: "Slideshow to video",
      description:
        "Build a narrated video from an already-uploaded PDF or slideshow file. Upload the file first with upload_file, then pass its fileId. Starts the workflow and, by default, waits for the finished render. ADD_TRANSITIONS + CONVERT_IMAGES_TO_VIDEOS make strong remixActions here.",
      inputSchema: slideshowToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().workflows.slideshowToVideo(dropUndefined(rest)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  // Storyboard-to-video is on the public OpenAPI; the hand-written SDK exposes
  // `workflows.storyboardToVideo` for this tool.
  server.registerTool(
    "storyboard_to_video",
    {
      title: "Storyboard to video",
      description:
        "Build a video from a structured storyboard of scenes. Starts the workflow and, by default, waits for the finished render. Pass quality HIGH and at least two remixActions (e.g. ENABLE_CAPTIONS + ADD_TRANSITIONS).",
      inputSchema: storyboardToVideoInputSchema,
      outputSchema: workflowRunOutputSchema,
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().workflows.storyboardToVideo(dropUndefined(rest)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "prompt_to_video_clip",
    {
      title: "Prompt to video",
      description:
        "Generate one short AI video clip (1-15 seconds) from a text prompt inside an editable project. VideoGen generates an opening frame (optionally guided by reference images), then animates it into a video. Starts the workflow and, by default, waits for the finished render. Does not accept remixActions. For a standalone clip without a project, use generate_video_clip. For longer narrated multi-scene videos, use script_to_video.",
      inputSchema: promptToVideoClipInputSchema,
      outputSchema: workflowRunOutputSchema,
    },
    async (args) => {
      const { wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().workflows.promptToVideoClip(dropUndefined(rest)),
        poll: (workflowRunId) => getClient().workflows.getWorkflowRun({ workflowRunId }),
        idKey: "workflowRunId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "list_workflow_runs",
    {
      title: "List workflow runs",
      description: "List workflow runs, most recent first.",
      inputSchema: listWorkflowRunsInputSchema,
      outputSchema: listWorkflowRunsOutputSchema,
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
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.cancelWorkflowRun({ workflowRunId: args.workflowRunId }),
      ),
  );
}
