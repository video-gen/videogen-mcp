import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  HOME_WIDGET_URI,
  WIDGET_MIME_TYPE,
  buildWidgetResourceMeta,
  getHomeWidgetHtml,
  getVideogenAppOrigin,
} from "../appWidget";
import { buildAppDeepLinkUrl } from "../appDeepLink";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";

export function registerHomeWidget(server: McpServer): void {
  const appOrigin = getVideogenAppOrigin();
  const meta = { ...buildWidgetResourceMeta({
    csp: {
      connectDomains: [],
      resourceDomains: [],
      redirectDomains: [appOrigin],
      frameDomains: [appOrigin],
    },
    widgetDescription:
      "VideoGen’s complete existing app, including its own navigation, assistants, examples, media library and video editor. The ChatGPT connection adds selected-project context.",
  }), "openai/ui": { availableDisplayModes: ["fullscreen"] } };
  server.registerResource(
    "videogen-home",
    HOME_WIDGET_URI,
    {
      mimeType: WIDGET_MIME_TYPE,
      _meta: meta,
    },
    () => ({
      contents: [
        {
          uri: HOME_WIDGET_URI,
          mimeType: WIDGET_MIME_TYPE,
          text: getHomeWidgetHtml(),
          _meta: meta,
        },
      ],
    }),
  );

  server.registerTool(
    "open_home",
    {
      title: "VideoGen",
      description:
        "Open the complete VideoGen app inside ChatGPT. Use its existing navigation, assistants, editable examples, media library and editor. Opening the app does not generate media or spend credits.",
      inputSchema: {},
      outputSchema: { appUrl: z.string().url() },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: {
        ui: { resourceUri: HOME_WIDGET_URI },
        "openai/ui": { entrypoints: [{ type: "global" }] },
        "openai/outputTemplate": HOME_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening VideoGen…",
        "openai/toolInvocation/invoked": "VideoGen ready",
        securitySchemes: [{ type: "noauth" }],
      },
    },
    () => ({
      content: [
        {
          type: "text",
          text: "VideoGen is open inside ChatGPT with its existing app interface and actions. Opening the app does not start generation.",
        },
      ],
      structuredContent: {
        appUrl: buildAppDeepLinkUrl({ type: "NAVIGATE", destination: "HOME" }),
      },
    }),
  );
}
