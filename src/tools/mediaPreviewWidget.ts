import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  MEDIA_PREVIEW_WIDGET_CSP,
  MEDIA_PREVIEW_WIDGET_URI,
  WIDGET_MIME_TYPE,
  buildWidgetResourceMeta,
  getMediaPreviewWidgetHtml,
} from "../appWidget";

/**
 * Registers the ChatGPT App media-preview UI resource (images / video / audio
 * from tool results). HOSTED-only — LOCAL stdio has no MCP Apps host bridge.
 *
 * Media-producing tools declare this URI via `openai/outputTemplate` /
 * `ui.resourceUri`; the iframe reads `structuredContent` from the tool result.
 */
export function registerMediaPreviewWidget(server: McpServer): void {
  const resourceMeta = buildWidgetResourceMeta({
    csp: MEDIA_PREVIEW_WIDGET_CSP,
    widgetDescription:
      "Inline preview of generated or exported VideoGen images, videos, and audio.",
  });

  server.registerResource(
    "videogen-media-preview-widget",
    MEDIA_PREVIEW_WIDGET_URI,
    {
      mimeType: WIDGET_MIME_TYPE,
      _meta: resourceMeta,
    },
    () => ({
      contents: [
        {
          uri: MEDIA_PREVIEW_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: getMediaPreviewWidgetHtml(),
          _meta: resourceMeta,
        },
      ],
    }),
  );
}
