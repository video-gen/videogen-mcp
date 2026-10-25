import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  UPLOAD_WIDGET_CSP,
  UPLOAD_WIDGET_URI,
  WIDGET_MIME_TYPE,
  buildWidgetResourceMeta,
  getUploadWidgetHtml,
} from "../appWidget";
import type { McpHostSurface } from "../hostSurface";
import { openUploaderChatgptInputSchema, openUploaderInputSchema } from "../inputSchemas";
import { openUploaderOutputSchema } from "../outputSchemas";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";

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
 * caller-supplied URL (no SSRF surface). On ChatGPT the tool also accepts the
 * attachments the user already added to the chat (`openai/fileParams`). The
 * widget downloads those bytes in the browser. This server does not.
 */
function readAttachedFileCount(args: unknown): number {
  if (typeof args !== "object" || args == null || !("files" in args)) {
    return 0;
  }

  return Array.isArray(args.files) ? args.files.length : 0;
}

export function registerUploadWidget(server: McpServer, hostSurface: McpHostSurface): void {
  const resourceMeta = buildWidgetResourceMeta({
    csp: UPLOAD_WIDGET_CSP,
    widgetDescription:
      "Lets the user pick a file and upload it to VideoGen, then returns its file id.",
  });

  server.registerResource(
    "videogen-upload-widget",
    UPLOAD_WIDGET_URI,
    {
      mimeType: WIDGET_MIME_TYPE,
      _meta: resourceMeta,
    },
    () => ({
      contents: [
        {
          uri: UPLOAD_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: getUploadWidgetHtml(),
          _meta: resourceMeta,
        },
      ],
    }),
  );

  server.registerTool(
    "open_uploader",
    {
      title: "Open uploader",
      description:
        hostSurface === "CHATGPT_APP"
          ? "Import photos or other files into VideoGen. When the user already attached files in this chat, pass every attachment in files. A filename is not the file and does not upload it. If nothing is attached yet, call this with no arguments so the user can pick the files. The vg_file_ id is reported after the upload finishes."
          : "Open an in-chat file uploader (ChatGPT only). The user picks a file, it is uploaded to VideoGen, and its file id (vg_file_...) is reported back for use in voiceover_to_video, slideshow_to_video, logos, or B-roll. Prefer this over asking the user to paste a link. On clients without in-chat UI, use upload_file (small files) or create_file_upload (large files) instead. Returns the uploader launch status; the file id arrives after the user completes the upload.",
      inputSchema: hostSurface === "CHATGPT_APP" ? openUploaderChatgptInputSchema : openUploaderInputSchema,
      outputSchema: openUploaderOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: {
        // The render tool links to the widget resource. `openai/outputTemplate`
        // is ChatGPT's compatibility alias for the MCP Apps standard
        // `ui.resourceUri`; set both so the widget renders across hosts.
        ui: { resourceUri: UPLOAD_WIDGET_URI },
        "openai/outputTemplate": UPLOAD_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening uploader…",
        "openai/toolInvocation/invoked": "Uploader ready",
        // Opens the widget only — no VideoGen API call. Advertise `noauth` so
        // ChatGPT can surface a callable tool before OAuth linking; the widget
        // itself uses the host's linked credential for upload.
        securitySchemes: [{ type: "noauth" }],
        ...(hostSurface === "CHATGPT_APP" ? { "openai/fileParams": ["files"] } : {}),
      },
    },
    (args) => ({
      content: [
        {
          type: "text",
          text:
            readAttachedFileCount(args) > 0
              ? "The uploader is importing the attached files. Their file ids will be reported when the upload finishes."
              : "Opening the VideoGen uploader. Choose a file to upload; I'll use it once it finishes processing.",
        },
      ],
      structuredContent: { status: "ready" },
      _meta: { "openai/outputTemplate": UPLOAD_WIDGET_URI },
    }),
  );
}
