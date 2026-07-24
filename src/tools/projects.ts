import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import {
  cursorField,
  limitField,
  pollControlShape,
  remixActionsSchema,
  selfOnlyField,
} from "../schemas";

const projectIdField = z.string().describe("Project id.");

export function registerProjectTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk, runComposite }: McpOperations,
): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List projects. API-created projects only by default; pass includeUiProjects to also include dashboard projects.",
      inputSchema: {
        cursor: cursorField,
        limit: limitField,
        selfOnly: selfOnlyField,
        includeUiProjects: z
          .boolean()
          .optional()
          .describe(
            "Include projects created in the VideoGen dashboard, not just API-created ones.",
          ),
      },
    },
    async (args) => await respondSdk(() => getClient().projects.listProjects(dropUndefined(args))),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Fetch metadata and the shareable URL for a single project.",
      inputSchema: { projectId: projectIdField },
    },
    async (args) =>
      await respondSdk(() => getClient().projects.getProject({ projectId: args.projectId })),
  );

  server.registerTool(
    "export_project",
    {
      title: "Export project",
      description:
        "Export a project to an MP4. Starts the export and, by default, waits until the download URL is ready.",
      inputSchema: {
        projectId: z.string().describe("Project id to export."),
        quality: z
          .enum(["STANDARD", "HIGH", "FULL_HIGH", "ULTRA_HIGH"])
          .optional()
          .describe("Export quality tier."),
        ...pollControlShape,
      },
    },
    async (args) => {
      const { projectId, wait, pollIntervalMs, timeoutMs, ...rest } = args;
      return await runComposite({
        start: () => getClient().projects.exportProject({ projectId }, dropUndefined(rest)),
        poll: (exportId) => getClient().projects.getProjectExport({ projectId, exportId }),
        idKey: "exportId",
        controls: extractControls({ wait, pollIntervalMs, timeoutMs }),
      });
    },
  );

  server.registerTool(
    "remix_project",
    {
      title: "Remix project",
      description:
        "Apply remix actions (music, logo, captions, transitions, natural-language edits) to an existing project. Poll with list_project_remix_actions for status.",
      inputSchema: {
        projectId: z.string().describe("Project id to remix."),
        remixActions: remixActionsSchema,
        saveAsNewProject: z
          .boolean()
          .optional()
          .describe(
            "When true, save the remixed result as a new project instead of editing in place.",
          ),
      },
    },
    async (args) => {
      const { projectId, ...body } = args;
      return await respondSdk(() =>
        getClient().projects.remixProject({ projectId }, dropUndefined(body)),
      );
    },
  );

  server.registerTool(
    "list_project_remix_actions",
    {
      title: "List project remix actions",
      description: "List the status of remix actions applied to a project.",
      inputSchema: { projectId: projectIdField },
    },
    async (args) =>
      await respondSdk(() =>
        getClient().projects.listProjectRemixActions({ projectId: args.projectId }),
      ),
  );
}
