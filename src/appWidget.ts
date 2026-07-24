import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The MCP resource URI for the ChatGPT App upload widget. Acts as the cache key
 * for the host, so bump it whenever the widget markup or bundle changes.
 */
export const UPLOAD_WIDGET_URI = "ui://widget/videogen-upload.html";

/**
 * The MCP Apps UI MIME type. A host only wires up the MCP Apps bridge (so
 * `window.openai` / `ui/*` messages work inside the iframe) for resources served
 * with exactly this type.
 */
export const WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

/**
 * A stable, app-unique domain for the widget. Required when submitting the app;
 * ChatGPT renders the widget sandboxed under `*.web-sandbox.oaiusercontent.com`.
 */
export const WIDGET_DOMAIN = "https://mcp.videogen.io";

/**
 * Content Security Policy for the widget iframe. `connectDomains` is the ONLY
 * network capability the widget needs: it PUTs the file bytes directly to the
 * pre-signed storage URL returned by `create_file_upload`, which is a Cloudflare
 * R2 host (`<account>.r2.cloudflarestorage.com`). Every MCP tool call goes
 * through the host bridge (`window.openai.callTool`), not a direct fetch, so no
 * other origins are required. Everything else (JS/CSS) is inlined, so there are
 * no external asset domains.
 */
export const WIDGET_CSP = {
  connectDomains: ["https://*.r2.cloudflarestorage.com"],
  resourceDomains: [],
} as const;

const WIDGET_ROOT_ID = "videogen-upload-root";

let cachedHtml: string | null = null;

/**
 * Builds the widget HTML served as the MCP resource, inlining the pre-built
 * browser bundle so the sandbox needs no external script origin. The bundle is
 * produced by `tsup.widget.config.ts` into `dist/widget/uploadWidget.global.js`
 * and ships in the package's `dist`; it is read once and cached.
 */
export function getUploadWidgetHtml(): string {
  if (cachedHtml != null) {
    return cachedHtml;
  }

  const bundlePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "widget",
    "uploadWidget.global.js",
  );
  const bundle = readFileSync(bundlePath, "utf8");

  cachedHtml = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "</head>",
    "<body>",
    `<div id="${WIDGET_ROOT_ID}"></div>`,
    `<script>${bundle}</script>`,
    "</body>",
    "</html>",
  ].join("");

  return cachedHtml;
}
