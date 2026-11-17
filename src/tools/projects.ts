import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  toExportProjectRequest,
  toRemixProjectRequest,
} from "../adapters/projectAdapters";
import { MEDIA_PREVIEW_TOOL_META } from "../appWidget";
import type { GetVideoGenClient } from "../client";
import { registerProjectEditingTools } from "./projectEditing";
import {
  exportProjectInputSchema,
  getProjectExportInputSchema,
  getProjectInputSchema,
  listProjectRemixActionsInputSchema,
  listProjectsInputSchema,
  remixProjectInputSchema,
  startVideoEditsInputSchema,
  listVideoEditsInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import {
  exportProjectOutputSchema,
  listProjectsOutputSchema,
  listRemixActionsOutputSchema,
  projectExportOutputSchema,
  projectOutputSchema,
  remixProjectOutputSchema,
  startVideoEditsOutputSchema,
  listVideoEditsOutputSchema,
} from "../outputSchemas";
import {
  DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PRIVATE_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

type MediaPreviewToolMeta = typeof MEDIA_PREVIEW_TOOL_META;

export function registerProjectTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
  mediaPreviewMeta: MediaPreviewToolMeta | null,
): void {
  registerProjectEditingTools(server, getClient, { respondSdk });
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "Browse projects in the authenticated team, including dashboard-created projects, most recently updated first. Returns project ids, titles, status, editor URLs, timestamps, and aspect ratios with a pagination cursor.",
      inputSchema: listProjectsInputSchema,
      outputSchema: listProjectsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.listProjects(dropUndefined(args)),
      ),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Return a project's title, readiness status, editor projectUrl, timestamps, aspectRatio, and assistantId when available. Use the projectId for subsequent video edits and export calls.",
      inputSchema: getProjectInputSchema,
      outputSchema: projectOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.getProject({ projectId: args.projectId }),
      ),
  );

  server.registerTool(
    "export_project",
    {
      title: "Export project",
      description:
        "Use when the user wants to download or deliver a finished VideoGen video as an MP4. Export the existing editable project; this does not publish to social media or an ad account. Wait for pending generation or editing work before exporting. Returns exportId on hosted clients; poll get_project_export with the same projectId for status, progress, errors, and downloadUrl when ready. Local calls wait for an export snapshot. Exports often take a few minutes; explain that wait before starting.",
      inputSchema: exportProjectInputSchema,
      outputSchema: exportProjectOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const { projectId } = args;
      return await runComposite({
        start: () =>
          getClient().projects.exportProject({
            projectId,
            ...toExportProjectRequest(args),
          }),
        poll: (exportId) =>
          getClient().projects.getProjectExport({ projectId, exportId }),
        idKey: "exportId",
        controls: {},
        attachMediaPreviewWidget: mediaPreviewMeta != null,
      });
    },
  );

  // Same as get_tool_execution: poll snapshots must not declare a widget on the
  // tool, or ChatGPT renders an empty preview for every in-progress check.
  server.registerTool(
    "get_project_export",
    {
      title: "Get project export",
      description:
        "Return an export snapshot with status, progress, errors, and downloadUrl, exportFileId, thumbnailUrl, and file metadata when ready. Poll until status is succeeded, failed, or cancelled.",
      inputSchema: getProjectExportInputSchema,
      outputSchema: projectExportOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(
        () =>
          getClient().projects.getProjectExport({
            projectId: args.projectId,
            exportId: args.exportId,
          }),
        { attachMediaPreviewWidget: true },
      ),
  );

  server.registerTool(
    "start_video_edits",
    {
      title: "Start video edits",
      description:
        "Apply supported background edits to the specified video. The original is edited in place unless saveAsNewProject is true. CONVERT_IMAGES_TO_VIDEOS generates clips and uses team credits; ZOOM adds camera motion. Poll list_video_edits for the returned videoEditIds before exporting. Use edit_video for typed timeline commands.",
      inputSchema: startVideoEditsInputSchema,
      outputSchema: startVideoEditsOutputSchema,
      annotations: DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.startVideoEdits({
          projectId: args.projectId,
          editableVideoId: args.editableVideoId,
          videoEdits: args.videoEdits,
          ...(args.saveAsNewProject == null
            ? {}
            : { saveAsNewProject: args.saveAsNewProject }),
        }),
      ),
  );
  server.registerTool(
    "list_video_edits",
    {
      title: "List video edits",
      description:
        "List background edit status and progress. Filter by editableVideoId and follow nextCursor; match the videoEditIds returned by the start request.",
      inputSchema: listVideoEditsInputSchema,
      outputSchema: listVideoEditsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.listVideoEdits(dropUndefined(args)),
      ),
  );

  server.registerTool(
    "remix_project",
    {
      title: "Remix project",
      description:
        "Use for AI video editing of an existing VideoGen project: apply caption, transition, or camera-motion edits, or animate its still images. The original project is edited in place unless saveAsNewProject is true; use that flag when the user wants a separate version. CONVERT_IMAGES_TO_VIDEOS generates clips from every still and uses substantial team credits. ZOOM adds camera motion at lower cost. Use only actions in the input schema; this is not arbitrary timeline editing. Poll list_project_remix_actions until edits finish, then export_project for a fresh MP4.",
      inputSchema: remixProjectInputSchema,
      outputSchema: remixProjectOutputSchema,
      annotations: DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const { projectId } = args;
      return await respondSdk(() =>
        getClient().projects.remixProject({
          projectId,
          ...toRemixProjectRequest(args),
        }),
      );
    },
  );

  server.registerTool(
    "list_project_remix_actions",
    {
      title: "List project remix actions",
      description:
        "Return remix actions for a project with action ids, types, status, progress, attempts, and error details, plus pagination metadata. Poll after remix_project to determine when edits are ready for export.",
      inputSchema: listProjectRemixActionsInputSchema,
      outputSchema: listRemixActionsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.listProjectRemixActions({
          projectId: args.projectId,
        }),
      ),
  );
}
