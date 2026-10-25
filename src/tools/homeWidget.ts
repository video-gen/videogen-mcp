import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  HOME_WIDGET_URI,
  MEDIA_PREVIEW_WIDGET_CSP,
  WIDGET_MIME_TYPE,
  buildWidgetResourceMeta,
  getHomeWidgetHtml,
} from "../appWidget";
import { buildAppDeepLinkUrl } from "../appDeepLink";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";

export function registerHomeWidget(server: McpServer): void {
  const meta = buildWidgetResourceMeta({
    csp: {
      ...MEDIA_PREVIEW_WIDGET_CSP,
      resourceDomains: [
        ...MEDIA_PREVIEW_WIDGET_CSP.resourceDomains,
        "https://static-assets.videogen.io",
        "https://videogen.io",
      ],
    },
    widgetDescription:
      "VideoGen home: describe what you want to create, browse recent projects, examples, workflows, and reusable assets.",
  });
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
        "Open VideoGen home to describe an idea, browse examples and featured workflows, and return to recent projects. Opening home does not generate media or spend credits.",
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
          text: "VideoGen home is ready. Describe what you want to create or browse the starting points.",
        },
      ],
      structuredContent: {
        appUrl: buildAppDeepLinkUrl({ type: "NAVIGATE", destination: "HOME" }),
      },
    }),
  );
}
