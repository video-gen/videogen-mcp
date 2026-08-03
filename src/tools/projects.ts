import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import {
  exportProjectOutputSchema,
  listProjectsOutputSchema,
  listRemixActionsOutputSchema,
  projectExportOutputSchema,
  projectOutputSchema,
  remixProjectOutputSchema,
} from "../outputSchemas";

type MediaPreviewToolMeta = typeof MEDIA_PREVIEW_TOOL_META;

export function registerProjectTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
  mediaPreviewMeta: MediaPreviewToolMeta | null,
): void {
  const mediaPreviewToolFields =
    mediaPreviewMeta != null ? { _meta: mediaPreviewMeta } : {};

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List projects. API-created projects only by default; pass includeUiProjects to also include dashboard projects.",
      inputSchema: listProjectsInputSchema,
      outputSchema: listProjectsOutputSchema,
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
    },
    async (args) =>
      await respondSdk(() => getClient().projects.getProject({ projectId: args.projectId })),
  );

  server.registerTool(
    "export_project",
    {
      title: "Export project",
      description:
        "Export a project to an MP4. Starts the export and, by default, waits until the download URL is ready. Pass wait:false and poll with get_project_export when the connection may time out.",
      inputSchema: exportProjectInputSchema,
      outputSchema: exportProjectOutputSchema,
      ...mediaPreviewToolFields,
    },
    async (args) => {
      const { projectId, wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().projects.exportProject(dropUndefined({ projectId, ...rest })),
        poll: (exportId) => getClient().projects.getProjectExport({ projectId, exportId }),
        idKey: "exportId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "get_project_export",
    {
      title: "Get project export",
      description:
        "Fetch the current status of a project export. Poll until status is succeeded, failed, or cancelled.",
      inputSchema: getProjectExportInputSchema,
      outputSchema: projectExportOutputSchema,
      ...mediaPreviewToolFields,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.getProjectExport({
          projectId: args.projectId,
          exportId: args.exportId,
        }),
      ),
  );

  server.registerTool(
    "remix_project",
    {
      title: "Remix project",
      description:
        "Apply remix actions (music, logo, captions, transitions, natural-language edits) to an existing project. Poll with list_project_remix_actions for status.",
      inputSchema: remixProjectInputSchema,
      outputSchema: remixProjectOutputSchema,
    },
    async (args) => {
      const { projectId, ...body } = args;
      return await respondSdk(() =>
        getClient().projects.remixProject(dropUndefined({ projectId, ...body })),
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
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.listProjectRemixActions({ projectId: args.projectId }),
      ),
  );
}
