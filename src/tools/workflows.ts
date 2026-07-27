import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JsonObject } from "@videogen/sdk";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import {
  aspectRatioSchema,
  captionStyleSchema,
  cursorField,
  imageQualitySchema,
  limitField,
  pollControlShape,
  remixActionsSchema,
  sdkFieldSchema,
  selfOnlyField,
  visualPacingSchema,
  visualStyleSchema,
} from "../schemas";

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
      inputSchema: {
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
      },
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
      inputSchema: {
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
      },
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
      inputSchema: {
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
      },
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
        "Build a video from a structured storyboard of scenes. Starts the workflow and, by default, waits for the finished render. This workflow does not accept remixActions.",
      inputSchema: {
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
      },
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
      inputSchema: {
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
      },
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
      inputSchema: { cursor: cursorField, limit: limitField, selfOnly: selfOnlyField },
    },
    async (args) =>
      await respondSdk(() => getClient().workflows.listWorkflowRuns(dropUndefined(args))),
  );

  server.registerTool(
    "get_workflow_run",
    {
      title: "Get workflow run",
      description: "Fetch the current status and result of a single workflow run.",
      inputSchema: { workflowRunId: z.string().describe("Workflow run id (vg_work_...).") },
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
      inputSchema: { workflowRunId: z.string().describe("Workflow run id (vg_work_...).") },
    },
    async (args) =>
      await respondSdk(() =>
        getClient().workflows.cancelWorkflowRun({ workflowRunId: args.workflowRunId }),
      ),
  );
}
