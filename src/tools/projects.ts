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
        "List projects. API-created projects only by default; pass includeUiProjects to also include dashboard projects.",
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
      description: "Fetch metadata and the shareable URL for a single project.",
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
        "Export a project to an MP4 and return its status or download URL. Renders often take a few minutes. Tell the user that wait up front.",
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
        "Fetch the current status of a project export. Poll until status is succeeded, failed, or cancelled.",
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
        "Apply curated edits to an existing project. Poll with list_project_remix_actions for status.",
      inputSchema: remixProjectInputSchema,
      outputSchema: remixProjectOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
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
      description: "List the status of remix actions applied to a project.",
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
