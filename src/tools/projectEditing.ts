import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import {
  EditVideoCommandsRequestSchema,
  EditableVideoInspectionSchema,
  ListProjectArtifactsResponseSchema,
  ProjectEditReceiptSchema,
  ProjectEditingCapabilitiesSchema,
  GetProjectArtifactResponseSchema,
} from "../generated/projectEditingSchemas";
import {
  ApplyProjectEditsRequestSchema,
  ProjectEditCommandSchema,
} from "../generated/projectCommandSchemas";
import type { McpOperations } from "../operations";
import {
  DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

const EDIT_ANNOTATIONS = {
  ...DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  idempotentHint: true,
};

export const registerProjectEditingTools = (
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: Pick<McpOperations, "respondSdk">,
): void => {
  const project = z
    .object({
      projectId: z.string().describe("Project id returned by list_projects."),
    })
    .strict();
  const video = project.extend({
    editableVideoId: z
      .string()
      .describe(
        "Exact video id from list_project_artifacts. Never choose the active or latest video implicitly.",
      ),
  });
  server.registerTool(
    "get_project_artifact",
    {
      title: "Read project artifact",
      description:
        "Inspect a specific workflow or editable-video artifact and its revision. Text pages use UTF-16 offsets; itemOffset/itemLimit page storyboard scenes or legacy slide scripts. Follow returned text offsets to read omitted content; omitted content remains present. Workflow settings edits do not alter already generated videos. Unavailable generationHistory means prior generation is unknown; do not assume a new, ungenerated draft.",
      inputSchema: project.extend({
        artifactId: z.string(),
        textOffset: z.number().int().nonnegative().optional(),
        textLimit: z.number().int().min(1).max(100_000).optional(),
        itemOffset: z.number().int().nonnegative().optional(),
        itemLimit: z.number().int().min(1).max(20).optional(),
      }),
      outputSchema: GetProjectArtifactResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().projects.getProjectArtifact(args)),
  );
  for (const domain of [
    {
      name: "edit_project",
      title: "Edit project",
      owner: "PROJECT",
      description:
        "Edit project presentation or rename a specific artifact. This changes folder/item metadata, not video content. Sharing and invitations are separate permission-sensitive actions.",
    },

    {
      name: "edit_workflow",
      title: "Edit workflow",
      owner: "WORKFLOW",
      description:
        "Edit supported settings in an explicitly selected saved workflow. This changes generation setup, not existing video output, and never regenerates or spends credits implicitly.",
    },
  ]) {
    const variants = ProjectEditCommandSchema.options.filter((variant) => {
      const owner = "workflowId" in variant.shape ? "WORKFLOW" : "PROJECT";
      return owner === domain.owner;
    });
    const [first, ...remaining] = variants;
    if (first == null)
      throw new McpError(
        ErrorCode.InternalError,
        "No editing commands are registered for this domain.",
      );
    server.registerTool(
      domain.name,
      {
        title: domain.title,
        description:
          domain.description +
          " Supply the inspected revisions for exactly the affected documents and a new mutationId UUID. A stale revision conflicts atomically; recover an uncertain result with get_project_edit.",
        inputSchema: ApplyProjectEditsRequestSchema.extend({
          projectId: z.string(),
          commands: z
            .array(z.discriminatedUnion("type", [first, ...remaining]))
            .min(1)
            .max(100),
        }),
        outputSchema: ProjectEditReceiptSchema.loose(),
        annotations: EDIT_ANNOTATIONS,
      },
      async (args) =>
        await respondSdk(() => getClient().projects.applyProjectEdits(args)),
    );
  }
  server.registerTool(
    "list_project_artifacts",
    {
      title: "List project artifacts",
      description:
        "Find the exact video or workflow to inspect/edit. Return stable typed ids and per-item revisions. App-created projects require the owner's explicit connection access in Developers settings.",
      inputSchema: project.extend({
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
      outputSchema: ListProjectArtifactsResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ projectId, limit, cursor }) =>
      await respondSdk(() =>
        getClient().projects.listProjectArtifacts({
          projectId,
          ...(limit == null ? {} : { limit }),
          ...(cursor == null ? {} : { cursor }),
        }),
      ),
  );
  server.registerTool(
    "get_project_editing_capabilities",
    {
      title: "Get editing capabilities",
      description:
        "Discover currently implemented commands, limits and effective write access. A listed command does not authorize generation, export, sharing or billing.",
      inputSchema: project,
      outputSchema: ProjectEditingCapabilitiesSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.getProjectEditingCapabilities(args),
      ),
  );
  server.registerTool(
    "inspect_video",
    {
      title: "Inspect video",
      description:
        "Read this video's revision-bound scenes, layers, timing, text and media properties before editing. Supply sectionId to page layers, layerId to page assets, or assetId to page stored transcript words with source timings and caption visibility. offset/limit page the selected level; textOffset pages long text in 512-character slices. Transcript timings are before trim/playback. This data does not establish composed visual or audio evidence.",
      inputSchema: video.extend({
        sectionId: z.string().optional(),
        layerId: z.string().optional(),
        assetId: z.string().optional(),
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Use the captured revision for continuation reads; a changed revision conflicts instead of mixing pages.",
          ),
        textOffset: z.number().int().nonnegative().optional(),
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      outputSchema: EditableVideoInspectionSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().projects.inspectEditableVideo(args)),
  );
  server.registerTool(
    "edit_video",
    {
      title: "Edit video",
      description:
        "Apply typed immediate edits to one explicitly selected editable video, or start one background edit on it. Inspect first, use its revision, and provide a new mutationId UUID. A repeated request must retain its original id, target, revision and commands. A CONFLICT means nothing was applied; re-read and reconsider before a new edit. Changes to text/prompts do not regenerate media. Enabling captions only displays available transcript data. A background command (logo, transitions, zoom, transcript cleanup, generation, translation, added or draft media, asset tools) must be sent alone; it returns STARTED with a videoEditId to poll with list_video_edits, and paid commands spend credits after the user agrees. This operation does not export or publish anything.",
      inputSchema: EditVideoCommandsRequestSchema.extend(video.shape),
      outputSchema: ProjectEditReceiptSchema.loose(),
      annotations: EDIT_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().projects.editVideo(args)),
  );
  server.registerTool(
    "get_project_edit",
    {
      title: "Get saved edit",
      description:
        "Recover this connection's original edit outcome after a timeout. Query this before retrying; do not create a replacement request to recover a missing response.",
      inputSchema: project.extend({ mutationId: z.string().uuid() }),
      outputSchema: ProjectEditReceiptSchema.loose(),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().projects.getProjectEdit(args)),
  );
  server.registerTool(
    "undo_project_edit",
    {
      title: "Undo edit",
      description:
        "Reverse this connection's saved document edit with guards that preserve other later changes. Supply a fresh newMutationId. Undo the returned edit to redo. This never reverses charges, reruns generation or changes an already exported file.",
      inputSchema: project.extend({
        mutationId: z.string().uuid(),
        newMutationId: z.string().uuid(),
      }),
      outputSchema: ProjectEditReceiptSchema.loose(),
      annotations: EDIT_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().projects.undoProjectEdit(args)),
  );
};
