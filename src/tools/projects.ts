import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  toExportProjectRequest,
  toRemixProjectRequest,
} from "../adapters/projectAdapters";
import { MEDIA_PREVIEW_TOOL_META } from "../appWidget";
import type { GetVideoGenClient } from "../client";
import {
  exportProjectInputSchema,
  getProjectExportInputSchema,
  getProjectInputSchema,
  listProjectRemixActionsInputSchema,
  listProjectsInputSchema,
  remixProjectInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import {
  exportProjectOutputSchema,
  listProjectsOutputSchema,
  listRemixActionsOutputSchema,
  projectExportOutputSchema,
  projectOutputSchema,
  remixProjectOutputSchema,
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
    async (args) => await respondSdk(() => getClient().projects.listProjects(dropUndefined(args))),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Return a project's title, readiness status, editor projectUrl, timestamps, aspectRatio, and assistantId when available. Use the projectId for subsequent remix and export calls.",
      inputSchema: getProjectInputSchema,
      outputSchema: projectOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().projects.getProject({ projectId: args.projectId })),
  );

  server.registerTool(
    "export_project",
    {
      title: "Export project",
      description:
        "Render an editable project to MP4. Returns exportId on hosted clients; poll get_project_export with the same projectId for status, progress, errors, and downloadUrl when ready. Local calls wait for an export snapshot. Renders often take a few minutes. Tell the user that wait up front.",
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
        poll: (exportId) => getClient().projects.getProjectExport({ projectId, exportId }),
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
    "remix_project",
    {
      title: "Remix project",
      description:
        "Apply curated edits to an existing project. The original project is edited in place unless saveAsNewProject is true. CONVERT_IMAGES_TO_VIDEOS generates AI video clips from every still and is expensive. Use ZOOM for cheap Ken Burns camera motion. Poll with list_project_remix_actions for status.",
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
      description: "Return remix actions for a project with action ids, types, status, progress, attempts, and error details, plus pagination metadata. Poll after remix_project to determine when edits are ready for export.",
      inputSchema: listProjectRemixActionsInputSchema,
      outputSchema: listRemixActionsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.listProjectRemixActions({ projectId: args.projectId }),
      ),
  );
}
