import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  UPLOAD_WIDGET_URI,
  WIDGET_CSP,
  WIDGET_DOMAIN,
  WIDGET_MIME_TYPE,
  getUploadWidgetHtml,
} from "../appWidget";

/**
 * Registers the ChatGPT App upload widget: an MCP UI resource (the widget HTML)
 * plus the `open_uploader` tool that renders it. HOSTED-only — the widget relies
 * on the ChatGPT MCP Apps bridge (`window.openai`), which the stdio (LOCAL)
 * transport has no host for; LOCAL uploads read the file by path instead.
 *
 * The point of the widget is that a ChatGPT user attaches a file WITHOUT the
 * model ever seeing a raw upload URL: the widget calls `create_file_upload`
 * itself and PUTs the bytes client-side (see `web/uploadWidget.tsx`), so the
 * pre-signed URL stays inside the iframe and the server never fetches a
 * caller-supplied URL (no SSRF surface).
 */
export function registerUploadWidget(server: McpServer): void {
  server.registerResource(
    "videogen-upload-widget",
    UPLOAD_WIDGET_URI,
    {
      mimeType: WIDGET_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: true,
          domain: WIDGET_DOMAIN,
          csp: {
            connectDomains: [...WIDGET_CSP.connectDomains],
            resourceDomains: [...WIDGET_CSP.resourceDomains],
          },
        },
        "openai/widgetDescription":
          "Lets the user pick a file and upload it to VideoGen, then returns its file id.",
      },
    },
    () => ({
      contents: [
        {
          uri: UPLOAD_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: getUploadWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              domain: WIDGET_DOMAIN,
              csp: {
                connectDomains: [...WIDGET_CSP.connectDomains],
                resourceDomains: [...WIDGET_CSP.resourceDomains],
              },
            },
          },
        },
      ],
    }),
  );

  server.registerTool(
    "open_uploader",
    {
      title: "Open uploader",
      description:
        "Open an in-chat file uploader (ChatGPT only). The user picks a file, it is uploaded to VideoGen, and its file id (vg_file_...) is reported back for use in voiceover_to_video, slideshow_to_video, logos, or B-roll. Prefer this over asking the user to paste a link. On clients without in-chat UI, use upload_file (small files) or create_file_upload (large files) instead.",
      inputSchema: {},
      _meta: {
        // The render tool links to the widget resource. `openai/outputTemplate`
        // is ChatGPT's compatibility alias for the MCP Apps standard
        // `ui.resourceUri`; set both so the widget renders across hosts.
        ui: { resourceUri: UPLOAD_WIDGET_URI },
        "openai/outputTemplate": UPLOAD_WIDGET_URI,
        // Opens the widget only — no VideoGen API call. Advertise `noauth` so
        // ChatGPT can surface a callable tool before OAuth linking; the widget
        // itself uses the host's linked credential for upload.
        securitySchemes: [{ type: "noauth" }],
      },
    },
    () => ({
      content: [
        {
          type: "text",
          text: "Opening the VideoGen uploader. Choose a file to upload; I'll use it once it finishes processing.",
        },
      ],
      structuredContent: { status: "ready" },
      _meta: { "openai/outputTemplate": UPLOAD_WIDGET_URI },
    }),
  );
}
