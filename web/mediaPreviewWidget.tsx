import { StrictMode, useEffect, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

/**
 * ChatGPT App media preview: renders images, videos, and audio from a tool
 * result's `structuredContent` (ExecutedTool results, FileInfo, ProjectExport).
 *
 * Hosts deliver the result via:
 * - `ui/notifications/tool-result` (MCP Apps bridge)
 * - `window.openai.toolOutput` + `openai:set_globals` (ChatGPT Apps SDK)
 *
 * Without a host bridge we show a short fallback telling the user to open the
 * download URL.
 */

type MediaKind = "image" | "video" | "audio" | "file";

type MediaItem = {
  kind: MediaKind;
  url: string;
  fileId: string | null;
  label: string | null;
};

type OpenAiHost = {
  toolOutput?: unknown;
  openExternal?: (args: { href: string }) => void;
};

declare global {
  interface Window {
    openai?: OpenAiHost;
  }
}

const ACCENT = "#2563eb";
const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function classifyType(fileType: string | null): MediaKind {
  if (fileType == null) {
    return "file";
  }

  const normalized = fileType.toUpperCase();

  if (
    normalized === "IMAGE" ||
    normalized.includes("IMAGE") ||
    normalized === "PNG" ||
    normalized === "JPEG" ||
    normalized === "JPG" ||
    normalized === "WEBP" ||
    normalized === "GIF" ||
    normalized === "SVG"
  ) {
    return "image";
  }

  if (normalized === "VIDEO" || normalized.includes("VIDEO") || normalized === "MP4") {
    return "video";
  }

  if (
    normalized === "AUDIO" ||
    normalized.includes("AUDIO") ||
    normalized === "MP3" ||
    normalized === "WAV" ||
    normalized === "M4A"
  ) {
    return "audio";
  }

  return "file";
}

function pushMediaItem({
  items,
  url,
  fileId,
  fileType,
  label,
}: {
  items: MediaItem[];
  url: string | null;
  fileId: string | null;
  fileType: string | null;
  label: string | null;
}): void {
  if (url == null) {
    return;
  }

  items.push({
    kind: classifyType(fileType),
    url,
    fileId,
    label,
  });
}

/**
 * Pulls previewable media URLs out of the shapes our MCP tools return:
 * ExecutedTool (`results[]`), FileInfo, and ProjectExport.
 */
function extractMediaItems(payload: unknown): MediaItem[] {
  if (!isRecord(payload)) {
    return [];
  }

  // Hosts sometimes wrap structuredContent one level deep.
  if (
    payload.structuredContent != null &&
    !Array.isArray(payload.results) &&
    readString(payload.fileId) == null &&
    readString(payload.exportId) == null
  ) {
    return extractMediaItems(payload.structuredContent);
  }

  const items: MediaItem[] = [];

  const results = payload.results;
  if (Array.isArray(results)) {
    for (const result of results) {
      if (!isRecord(result)) {
        continue;
      }

      const nestedFile = isRecord(result.file) ? result.file : null;
      const fileType =
        readString(result.type) ?? (nestedFile != null ? readString(nestedFile.type) : null);
      const url =
        readString(result.downloadUrl) ??
        readString(result.thumbnailUrl) ??
        (nestedFile != null
          ? (readString(nestedFile.downloadUrl) ?? readString(nestedFile.thumbnailUrl))
          : null);
      const fileId =
        readString(result.fileId) ?? (nestedFile != null ? readString(nestedFile.fileId) : null);

      pushMediaItem({
        items,
        url,
        fileId,
        fileType,
        label: nestedFile != null ? readString(nestedFile.displayName) : null,
      });
    }
  }

  // Bare FileInfo (get_file / upload_file)
  if (readString(payload.fileId) != null && !Array.isArray(payload.results)) {
    pushMediaItem({
      items,
      url: readString(payload.downloadUrl) ?? readString(payload.thumbnailUrl),
      fileId: readString(payload.fileId),
      fileType: readString(payload.type),
      label: readString(payload.displayName),
    });
  }

  // ProjectExport (export_project after wait)
  if (readString(payload.exportId) != null) {
    const nestedFile = isRecord(payload.file) ? payload.file : null;
    pushMediaItem({
      items,
      url:
        readString(payload.downloadUrl) ??
        readString(payload.thumbnailUrl) ??
        (nestedFile != null
          ? (readString(nestedFile.downloadUrl) ?? readString(nestedFile.thumbnailUrl))
          : null),
      fileId:
        readString(payload.exportFileId) ??
        (nestedFile != null ? readString(nestedFile.fileId) : null),
      fileType: nestedFile != null ? readString(nestedFile.type) : "VIDEO",
      label: "Export",
    });
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);

    return true;
  });
}

function readStructuredContent(message: unknown): unknown {
  if (!isRecord(message)) {
    return null;
  }

  if (message.structuredContent != null) {
    return message.structuredContent;
  }

  if (!isRecord(message.params)) {
    return null;
  }

  const params = message.params;

  if (params.structuredContent != null) {
    return params.structuredContent;
  }

  if (isRecord(params.result) && params.result.structuredContent != null) {
    return params.result.structuredContent;
  }

  // Some hosts only put a JSON text content block (no structuredContent).
  if (Array.isArray(params.content)) {
    for (const block of params.content) {
      if (!isRecord(block) || block.type !== "text") {
        continue;
      }

      const text = readString(block.text);
      if (text == null) {
        continue;
      }

      try {
        return JSON.parse(text);
      } catch {
        // not JSON
      }
    }
  }

  return null;
}

function resolveToolOutputPayload(toolOutput: unknown): unknown {
  if (toolOutput == null) {
    return null;
  }

  // ChatGPT documents toolOutput as structuredContent itself, but some hosts
  // pass the full CallToolResult envelope.
  if (isRecord(toolOutput) && toolOutput.structuredContent != null) {
    const nested = extractMediaItems(toolOutput.structuredContent);
    if (nested.length > 0) {
      return toolOutput.structuredContent;
    }
  }

  return toolOutput;
}

function MediaPreviewWidget(): ReactElement {
  const [items, setItems] = useState<MediaItem[]>(() =>
    extractMediaItems(resolveToolOutputPayload(window.openai?.toolOutput)),
  );

  useEffect(() => {
    const applyPayload = (payload: unknown): void => {
      const nextItems = extractMediaItems(payload);
      if (nextItems.length > 0) {
        setItems(nextItems);
      }
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data;
      if (!isRecord(message) || message.jsonrpc !== "2.0") {
        return;
      }

      if (message.method !== "ui/notifications/tool-result") {
        return;
      }

      const payload = readStructuredContent(message) ?? readStructuredContent(message.params);
      applyPayload(payload);
    };

    // ChatGPT delivers `window.openai.toolOutput` asynchronously via this event
    // (see Apps SDK `useOpenAiGlobal` / dice example). Without it, the widget
    // stays on the empty placeholder even after generation succeeds.
    const onSetGlobals = (event: Event): void => {
      const detail = (event as CustomEvent<{ globals?: { toolOutput?: unknown } }>).detail;
      const toolOutput = detail?.globals?.toolOutput ?? window.openai?.toolOutput;
      applyPayload(resolveToolOutputPayload(toolOutput));
    };

    window.addEventListener("message", onMessage);
    window.addEventListener(SET_GLOBALS_EVENT_TYPE, onSetGlobals, { passive: true });

    applyPayload(resolveToolOutputPayload(window.openai?.toolOutput));

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, onSetGlobals);
    };
  }, []);

  const openUrl = (url: string): void => {
    if (window.openai?.openExternal != null) {
      window.openai.openExternal({ href: url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (items.length === 0) {
    return (
      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          color: "#6b7280",
          padding: 12,
        }}
      >
        Media will appear here when a download URL is ready. If generation is still
        running, wait for it to finish.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 8,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {items.map((item) => (
        <div
          key={item.url}
          style={{
            borderRadius: 12,
            overflow: "hidden",
            background: "#0b0f19",
            border: "1px solid #1f2937",
          }}
        >
          {item.kind === "image" ? (
            <img
              src={item.url}
              alt={item.label ?? "Generated image"}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          ) : null}
          {item.kind === "video" ? (
            <video
              src={item.url}
              controls
              playsInline
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          ) : null}
          {item.kind === "audio" ? (
            <div style={{ padding: 12 }}>
              <audio src={item.url} controls style={{ width: "100%" }} />
            </div>
          ) : null}
          {item.kind === "file" ? (
            <div style={{ padding: 12, color: "#e5e7eb", fontSize: 14 }}>
              Preview unavailable for this file type.
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              padding: "8px 12px",
              background: "#111827",
              color: "#d1d5db",
              fontSize: 12,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label ?? item.fileId ?? item.kind}
            </span>
            <button
              type="button"
              onClick={() => {
                openUrl(item.url);
              }}
              style={{
                color: ACCENT,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                flexShrink: 0,
                fontSize: 12,
              }}
            >
              Open
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const rootElement = document.getElementById("videogen-media-preview-root");

if (rootElement != null) {
  createRoot(rootElement).render(
    <StrictMode>
      <MediaPreviewWidget />
    </StrictMode>,
  );
}
