import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import type { McpOperations } from "../operations";
import {
  DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

const assistantId = z.string().min(1).describe("Assistant id returned by start_assistant_chat or get_project (vg_asst_...).");
const messageId = z.string().min(1).describe("Message id returned by an assistant write (vg_mesg_...). Keep polling this same id.");
const message = z.string().trim().min(1).describe("The user's request for VideoGen's project assistant. Preserve their constraints and references; do not substitute a different task.");
const acceptedOutput = z.object({ messageId }).passthrough();
const projectFields = {
  assistantId,
  projectId: z.string(),
  projectUrl: z.string(),
};
const messageOutput = z.object({
  messageId,
  role: z.enum(["user", "assistant"]),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]),
  content: z.string().nullable(),
  actions: z.array(z.object({
    actionId: z.string(),
    kind: z.string(),
    label: z.string(),
    requiresApp: z.boolean().describe("If true, complete this action in the existing embedded project; it cannot be approved through MCP."),
  }).passthrough()).optional(),
  generation: z.object({ workflowRunId: z.string(), projectId: z.string(), projectUrl: z.string() }).passthrough().nullish(),
  error: z.object({ message: z.string(), code: z.string().optional() }).passthrough().nullish(),
}).passthrough();

// Assistant requests can edit an existing project and research public sources.
const assistantMutationAnnotations = {
  ...DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  openWorldHint: true,
};

/** Thin SDK adapters: the existing assistant API owns access, execution and persistence. */
export function registerAssistantTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: Pick<McpOperations, "respondSdk">,
): void {
  server.registerTool(
    "start_assistant_chat",
    {
      title: "Start VideoGen assistant chat",
      description: "Delegate a new project request to VideoGen's in-app AI assistant, including tasks beyond dedicated MCP tools. Creates a new project and durable chat; do not use for an existing project. May spend credits. Returns immediately with assistantId, projectId, projectUrl and messageId; poll get_assistant_message. Automatic generation intent is off; the assistant follows the supplied request. Do not retry a successful start to poll it. Read get_getting_started_guidance for limitations and approvals.",
      inputSchema: z.object({ message }),
      outputSchema: acceptedOutput.extend(projectFields),
      annotations: WRITE_PUBLIC_IMPORT_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().assistant.startAssistantChat({ message: args.message, autoGenerate: false })),
  );
  server.registerTool(
    "get_assistant",
    {
      title: "Get VideoGen assistant chat",
      description: "Read a VideoGen project assistant's complete chronological conversation, actions, projectId and projectUrl. Use the existing assistantId from get_project or start_assistant_chat to preserve context. Existing API access rules apply: dashboard-created projects are not supported by this assistant API.",
      inputSchema: z.object({ assistantId }),
      outputSchema: z.object({ ...projectFields, messages: z.array(messageOutput) }),
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().assistant.getAssistant(args)),
  );
  server.registerTool(
    "send_assistant_message",
    {
      title: "Send VideoGen assistant message",
      description: "Ask VideoGen's in-app assistant to continue work on this existing API-created project, including requests beyond dedicated MCP tools. Can edit the project or spend credits according to the user's request. Reuse its assistantId; never start a replacement project to continue. Returns a pending reply's messageId immediately; poll get_assistant_message. Replies and proposed actions are not proof that an edit or video has completed.",
      inputSchema: z.object({ assistantId, message }),
      outputSchema: acceptedOutput,
      annotations: assistantMutationAnnotations,
    },
    async (args) => await respondSdk(() => getClient().assistant.sendAssistantMessage(args)),
  );
  server.registerTool(
    "get_assistant_message",
    {
      title: "Get VideoGen assistant message",
      description: "Poll the exact messageId returned by start_assistant_chat, send_assistant_message or act_on_assistant_action until succeeded, failed or cancelled. Returns reply text, actions (including requiresApp), errors and any linked generation. Succeeded means this reply finished, not that all project work finished. Poll linked workflowRunId with get_workflow_run and inspect the project before claiming completion.",
      inputSchema: z.object({ messageId }),
      outputSchema: messageOutput,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().assistant.getAssistantMessage(args)),
  );
  server.registerTool(
    "act_on_assistant_action",
    {
      title: "Respond to VideoGen assistant action",
      description: "Approve or reject a specific action offered by this assistant. Use its actual actionId and only actions with requiresApp=false. Approvals can edit the existing project or spend credits; ensure the proposed action is authorized by the user. Supply an explicit decision; never approve app-only actions or fabricate ids. Returns messageId for an acknowledgment; read the chat and project to verify the underlying work. For requiresApp=true, direct the user to that same project in the embedded app.",
      inputSchema: z.object({ assistantId, actionId: z.string().min(1), decision: z.enum(["APPROVE", "REJECT"]) }),
      outputSchema: acceptedOutput,
      annotations: assistantMutationAnnotations,
    },
    async (args) => await respondSdk(() => getClient().assistant.actOnAssistantAction(args)),
  );
}
