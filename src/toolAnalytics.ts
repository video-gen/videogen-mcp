import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Deliberately omit free text, URLs, credentials, and media from analytics.
const referencesSchema = z.object({
  projectId: z.string().max(128).optional(),
  workflowRunId: z.string().max(128).optional(),
  toolExecutionId: z.string().max(128).optional(),
  exportId: z.string().max(128).optional(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).optional(),
});

export type McpToolAnalyticsEvent = {
  eventId: string;
  toolName: string;
  startedAtMse: number;
  durationMs: number;
  isError: boolean;
  inputReferences: z.infer<typeof referencesSchema>;
  outputReferences: z.infer<typeof referencesSchema>;
};

export type McpToolAnalyticsObserver = (event: McpToolAnalyticsEvent) => Promise<void>;

const getReferences = (value: unknown): z.infer<typeof referencesSchema> => {
  const parsed = referencesSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
};

/** Observe actual handlers, without changing discovery schemas or tool results. */
export function observeMcpTools(server: McpServer, observe: McpToolAnalyticsObserver): void {
  const registeredTools = new Set<string>();
  const registerTool = server.registerTool.bind(server);
  server.registerTool = (name, config, callback) => {
    registeredTools.add(name);
    return registerTool(name, config, callback);
  };
  const setRequestHandler = server.server.setRequestHandler.bind(server.server);
  server.server.setRequestHandler = (schema, handler) => {
    setRequestHandler(schema, async (request, extra) => {
      const call = CallToolRequestSchema.safeParse(request);
      if (!call.success || !registeredTools.has(call.data.params.name)) {
        return await handler(request, extra);
      }
      const startedAtMse = Date.now();
      const started = performance.now();
      let isError = true;
      let outputReferences: z.infer<typeof referencesSchema> = {};
      try {
        const result = await handler(request, extra);
        const parsed = CallToolResultSchema.safeParse(result);
        isError = !parsed.success || parsed.data.isError === true;
        outputReferences = parsed.success ? getReferences(parsed.data.structuredContent) : {};
        return result;
      } finally {
        try {
          await observe({
            eventId: randomUUID(),
            toolName: call.data.params.name,
            startedAtMse,
            durationMs: performance.now() - started,
            isError,
            inputReferences: getReferences(call.data.params.arguments),
            outputReferences,
          });
        } catch {
          // Observers own diagnostic logging. Never replace the handler's result/error.
        }
      }
    });
  };
}

/** Hosted-only receiver uses existing API authentication, Redis, and PostHog config. */
export async function sendMcpToolAnalytics({
  baseUrl,
  bearerToken,
  clientName,
  event,
}: {
  baseUrl: string;
  bearerToken: string;
  clientName: string;
  event: McpToolAnalyticsEvent;
}): Promise<void> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/internal/mcp-analytics`, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
        "x-videogen-client": clientName,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(2500),
    });
    await response.body?.cancel();
    if (!response.ok) {
      process.stderr.write(`[videogen-mcp] Analytics receiver returned HTTP ${response.status}.\n`);
    }
  } catch {
    // Do not log fetch errors: they can contain bearer tokens or request bodies.
    process.stderr.write("[videogen-mcp] Failed to send tool analytics.\n");
  }
}
