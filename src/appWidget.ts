import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAppDeepLinkUrl } from "./appDeepLink";

/**
 * Versioned resource URI so hosts do not reuse the pre-handshake upload bundle.
 */
export const UPLOAD_WIDGET_URI = "ui://widget/videogen-upload-v3.html";

/**
 * Inline media preview for generation / export / file tool results (images,
 * videos, audio). v3 also registers the first-party Open in app target.
 */
export const MEDIA_PREVIEW_WIDGET_URI =
  "ui://widget/videogen-media-preview-v3.html";

export const HOME_WIDGET_URI = "ui://widget/videogen-app-v4.html";

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
 * Hosts that signed media / upload URLs may come from. Must stay in sync with
 * developer-API download + thumbnail URL origins (see `storageFileSource.ts`,
 * Mux / Cloudflare Images / R2 helpers, and deprecated workspace GCS CDN).
 *
 * Categories:
 * - Mux (default + VideoGen DNS-mapped)
 * - Cloudflare Images delivery + per-env download Workers
 * - Cloudflare R2 (signed S3 API + public-preview buckets)
 * - GCS / deprecated workspace CDN
 */
const MEDIA_RESOURCE_DOMAINS = [
  // Mux — default hosts (non-prod signed + any env still on mux.com)
  "https://stream.mux.com",
  "https://image.mux.com",
  // Mux — VideoGen DNS-mapped hosts (prod / template library)
  "https://stream.media.videogen.io",
  "https://image.media.videogen.io",
  // Cloudflare Images — inline signed / public delivery
  "https://imagedelivery.net",
  // Cloudflare Images — Content-Disposition download Workers
  "https://image-download.videogen.io",
  "https://image-download-prod.videogen.io",
  "https://image-download-prerelease.videogen.io",
  "https://image-download-dev.videogen.io",
  "https://image-download-local.videogen.io",
  // Cloudflare R2 — storage-file download Workers (prod on videogen.io;
  // local / DEV / PRERELEASE on Sandbox videogen-sandbox.io)
  "https://storage-download.videogen.io",
  "https://storage-download-prod.videogen.io",
  "https://storage-download-prerelease.videogen-sandbox.io",
  "https://storage-download-dev.videogen-sandbox.io",
  "https://storage-download-local.videogen-sandbox.io",
  // Cloudflare R2 — pre-signed object URLs
  "https://*.r2.cloudflarestorage.com",
  // Cloudflare R2 — public stock-music bucket
  "https://music.videogen.io",
  // Cloudflare R2 — public-preview bucket custom / r2.dev hosts
  "https://public-previews.videogen.io",
  "https://*.r2.dev",
  // GCS signed URLs (still used for some workspace / asset paths)
  "https://storage.googleapis.com",
  "https://*.googleapis.com",
  // Deprecated workspace storage CDN (GCS fronted; still referenced in old files)
  "https://workspace-storage.videogen.io",
] as const;

/**
 * Content Security Policy for the upload widget iframe. `connectDomains` is the
 * network capability it needs: PUTs to the pre-signed storage URL from
 * `create_file_upload` (Cloudflare R2), and browser fetches of ChatGPT
 * attachment bytes from `*.oaiusercontent.com`. The MCP server never fetches
 * those attachment URLs. MCP tool calls go through the host bridge.
 */
export const getUploadWidgetCsp = (): WidgetCsp => ({
  connectDomains: [
    "https://*.r2.cloudflarestorage.com",
    "https://*.oaiusercontent.com",
    "https://oaiusercontent.com",
  ],
  resourceDomains: [],
  /**
   * ChatGPT-only: allowlist for `window.openai.openExternal` (safe-link skip).
   * Not expressible on `_meta.ui.csp` — must live under `openai/widgetCSP`.
   */
  redirectDomains: [...MEDIA_RESOURCE_DOMAINS, getVideogenAppOrigin()],
});

/** The app origin for this server's environment, so other environments' apps are never allowlisted. */
export const getVideogenAppOrigin = (): string =>
  new URL(buildAppDeepLinkUrl({ type: "NAVIGATE", destination: "HOME" })).origin;

/**
 * Media preview loads signed download / thumbnail / video URLs as img/video/audio
 * `src`, so those hosts must be in `resourceDomains`. Workspace file downloads
 * are GCS or Mux signed URLs; upload PUTs (and some assets) use R2.
 *
 * `redirectDomains` is only for `openExternal` — the Open button goes to the
 * VideoGen Media page (`/media?storageFileId=…`), not signed storage URLs
 * (hosts append query params and break signatures). See
 * `.cursor/rules/no-signed-storage-urls-in-external-widgets.mdc`.
 */
export const getMediaPreviewWidgetCsp = (): WidgetCsp => ({
  connectDomains: [],
  resourceDomains: [...MEDIA_RESOURCE_DOMAINS],
  redirectDomains: [getVideogenAppOrigin()],
});

type WidgetCsp = {
  connectDomains: readonly string[];
  resourceDomains: readonly string[];
  redirectDomains: readonly string[];
  frameDomains?: readonly string[];
};

/**
 * Resource `_meta` for ChatGPT Apps / MCP Apps hosts.
 *
 * Per OpenAI Apps SDK docs (https://developers.openai.com/apps-sdk/reference):
 * - Prefer `_meta.ui.csp` (`connectDomains` / `resourceDomains`) + `_meta.ui.domain`
 * - Also set legacy `openai/widgetCSP` (snake_case) for ChatGPT compatibility;
 *   `redirect_domains` is ONLY supported there (for `openExternal`)
 * - Mirror domain as `openai/widgetDomain`
 */
export function buildWidgetResourceMeta({
  csp,
  widgetDescription,
}: {
  csp: WidgetCsp;
  widgetDescription: string;
}): {
  ui: {
    prefersBorder: true;
    domain: typeof WIDGET_DOMAIN;
    csp: {
      connectDomains: string[];
      resourceDomains: string[];
      frameDomains?: string[];
    };
  };
  "openai/widgetDescription": string;
  "openai/widgetDomain": typeof WIDGET_DOMAIN;
  "openai/widgetCSP": {
    connect_domains: string[];
    resource_domains: string[];
    redirect_domains: string[];
    frame_domains?: string[];
  };
  "openai/widgetPrefersBorder": true;
} {
  const connectDomains = [...csp.connectDomains];
  const resourceDomains = [...csp.resourceDomains];
  const redirectDomains = [...csp.redirectDomains];

  return {
    ui: {
      prefersBorder: true,
      domain: WIDGET_DOMAIN,
      csp: {
        connectDomains,
        resourceDomains,
        ...(csp.frameDomains == null
          ? {}
          : { frameDomains: [...csp.frameDomains] }),
      },
    },
    "openai/widgetDescription": widgetDescription,
    "openai/widgetDomain": WIDGET_DOMAIN,
    "openai/widgetCSP": {
      connect_domains: connectDomains,
      resource_domains: resourceDomains,
      redirect_domains: redirectDomains,
      ...(csp.frameDomains == null
        ? {}
        : { frame_domains: [...csp.frameDomains] }),
    },
    "openai/widgetPrefersBorder": true,
  };
}

const UPLOAD_WIDGET_ROOT_ID = "videogen-upload-root";
const MEDIA_PREVIEW_WIDGET_ROOT_ID = "videogen-media-preview-root";

let cachedUploadHtml: string | null = null;
let cachedMediaPreviewHtml: string | null = null;
let cachedHomeHtml: string | null = null;

const readWidgetBundle = ({
  bundleFileName,
}: {
  bundleFileName: string;
}): string => {
  const bundlePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "widget",
    bundleFileName,
  );

  // Source-based MCP tests/dev runs still consume the built browser bundle.
  const sourceBuildPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
    "widget",
    bundleFileName,
  );
  return readFileSync(
    existsSync(bundlePath) ? bundlePath : sourceBuildPath,
    "utf8",
  );
};

const buildWidgetHtml = ({
  rootId,
  bundleFileName,
}: {
  rootId: string;
  bundleFileName: string;
}): string => {
  const bundle = readWidgetBundle({ bundleFileName });

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "</head>",
    '<body style="margin:0;background:transparent;">',
    `<div id="${rootId}" data-app-url="${getVideogenAppOrigin()}"></div>`,
    `<script>${bundle}</script>`,
    "</body>",
    "</html>",
  ].join("");
};

/**
 * Builds the upload widget HTML served as the MCP resource, inlining the
 * pre-built browser bundle so the sandbox needs no external script origin.
 */
export function getUploadWidgetHtml(): string {
  if (cachedUploadHtml != null) {
    return cachedUploadHtml;
  }

  cachedUploadHtml = buildWidgetHtml({
    rootId: UPLOAD_WIDGET_ROOT_ID,
    bundleFileName: "uploadWidget.global.js",
  });

  return cachedUploadHtml;
}

/**
 * Builds the media-preview widget HTML (images / video / audio from tool
 * results), inlining the pre-built browser bundle.
 */
export function getMediaPreviewWidgetHtml(): string {
  if (cachedMediaPreviewHtml != null) {
    return cachedMediaPreviewHtml;
  }

  cachedMediaPreviewHtml = buildWidgetHtml({
    rootId: MEDIA_PREVIEW_WIDGET_ROOT_ID,
    bundleFileName: "mediaPreviewWidget.global.js",
  });

  return cachedMediaPreviewHtml;
}

export function getHomeWidgetHtml(): string {
  cachedHomeHtml ??= buildWidgetHtml({
    rootId: "videogen-home-root",
    bundleFileName: "homeWidget.global.js",
  });
  return cachedHomeHtml;
}

/** Tool `_meta` that tells ChatGPT / MCP Apps hosts to render the media preview. */
export const MEDIA_PREVIEW_TOOL_META = {
  ui: { resourceUri: MEDIA_PREVIEW_WIDGET_URI },
  "openai/outputTemplate": MEDIA_PREVIEW_WIDGET_URI,
} as const;
