import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpHostSurface } from "../hostSurface";
import { emptyInputSchema } from "../inputSchemas";
import { guidanceDocumentOutputSchema } from "../outputSchemas";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";
import { GUIDANCE_MIME_TYPE, getGuidanceDocuments } from "./documents";

/**
 * Registers Mixpanel-style operational guidance: static `guidance://…` resources
 * plus mirror no-arg tools. Many MCP hosts never auto-attach resources, so the
 * tools are the model-controlled path; descriptions point at the matching URI.
 *
 * Credits / billing copy differs by `hostSurface` (ChatGPT Apps must not direct
 * users to purchase digital goods). See `.cursor/rules/chatgpt-mcp-no-commerce.mdc`.
 *
 * Public product docs only — advertised as `noauth` so hosts can load guidance
 * before the user links an API key / OAuth session.
 */
export function registerGuidance(server: McpServer, hostSurface: McpHostSurface): void {
  const documents = getGuidanceDocuments({ hostSurface });

  for (const doc of documents) {
    server.registerResource(
      doc.resourceName,
      doc.uri,
      {
        title: doc.title,
        description: doc.description,
        mimeType: GUIDANCE_MIME_TYPE,
      },
      () => ({
        contents: [
          {
            uri: doc.uri,
            mimeType: GUIDANCE_MIME_TYPE,
            text: doc.markdown,
          },
        ],
      }),
    );

    server.registerTool(
      doc.toolName,
      {
        title: doc.title,
        description: `${doc.description} Equivalent to reading the \`${doc.uri}\` MCP resource — provided as a tool for clients that don't read resources directly.`,
        inputSchema: emptyInputSchema,
        outputSchema: guidanceDocumentOutputSchema,
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
        _meta: {
          securitySchemes: [{ type: "noauth" }],
        },
      },
      () => ({
        content: [
          {
            type: "text" as const,
            text: doc.markdown,
          },
        ],
        structuredContent: { markdown: doc.markdown },
      }),
    );
  }
}
