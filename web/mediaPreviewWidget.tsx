import { StrictMode, useEffect, useRef, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  buildPersistedMediaWidgetState,
  extractMediaItems,
  mergeMediaItemsWithPersistedState,
  readPersistedMediaItems,
  readStructuredContent,
  rehydrateMediaItemByFileId,
  rehydrateMediaItems,
  resolveToolOutputPayload,
  type MediaItem,
} from "./mediaPreviewExtract";

/**
 * ChatGPT App media preview: renders images, videos, and audio from a tool
 * result's `structuredContent` (ExecutedTool results, FileInfo, ProjectExport).
 *
 * Hosts deliver the result via:
 * - `ui/notifications/tool-result` (MCP Apps bridge)
 * - `window.openai.toolOutput` + `openai:set_globals` (ChatGPT Apps SDK)
 *
 * On refresh ChatGPT often restores toolOutput without signed download URLs.
 * We persist media rows in `widgetState` and rehydrate missing previews via
 * `get_file` when a `fileId` is still available.
 */

const ACCENT = "#2563eb";
const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

function mediaItemReactKey(item: MediaItem, index: number): string {
  return item.fileId ?? item.previewUrl ?? item.appMediaUrl ?? `media-${index}`;
}

function MediaPreviewWidget(): ReactElement {
  const [items, setItems] = useState<MediaItem[]>(() => {
    const fromTool = extractMediaItems(resolveToolOutputPayload(window.openai?.toolOutput));
    const fromState = readPersistedMediaItems(window.openai?.widgetState);

    return mergeMediaItemsWithPersistedState({
      fromToolOutput: fromTool,
      fromWidgetState: fromState,
    });
  });
  const [isRehydrating, setIsRehydrating] = useState(false);
  const rehydrateInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const persistItems = (nextItems: MediaItem[]): void => {
      if (nextItems.length === 0) {
        return;
      }

      try {
        window.openai?.setWidgetState?.(buildPersistedMediaWidgetState(nextItems));
      } catch {
        // Persistence is best-effort.
      }
    };

    const applyPayload = (payload: unknown): void => {
      const fromToolOutput = extractMediaItems(payload);
      const fromWidgetState = readPersistedMediaItems(window.openai?.widgetState);
      const merged = mergeMediaItemsWithPersistedState({
        fromToolOutput,
        fromWidgetState,
      });

      if (merged.length === 0) {
        return;
      }

      setItems(merged);
      persistItems(merged);

      const needsRehydrate = merged.some(
        (item) => item.previewUrl == null && item.fileId != null,
      );
      if (!needsRehydrate) {
        return;
      }

      const callTool = window.openai?.callTool;
      if (callTool == null || rehydrateInFlightRef.current) {
        return;
      }

      rehydrateInFlightRef.current = true;
      setIsRehydrating(true);

      void (async () => {
        try {
          const hydrated = await rehydrateMediaItems({ items: merged, callTool });
          if (cancelled) {
            return;
          }

          setItems(hydrated);
          persistItems(hydrated);
        } finally {
          rehydrateInFlightRef.current = false;
          if (!cancelled) {
            setIsRehydrating(false);
          }
        }
      })();
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data;
      if (
        typeof message !== "object" ||
        message == null ||
        (message as { jsonrpc?: unknown }).jsonrpc !== "2.0"
      ) {
        return;
      }

      if ((message as { method?: unknown }).method !== "ui/notifications/tool-result") {
        return;
      }

      const payload = readStructuredContent(message) ?? readStructuredContent(
        (message as { params?: unknown }).params,
      );
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
      cancelled = true;
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

  const onPreviewLoadError = (fileId: string | null): void => {
    if (fileId == null || window.openai?.callTool == null || rehydrateInFlightRef.current) {
      return;
    }

    const callTool = window.openai.callTool;
    rehydrateInFlightRef.current = true;
    setIsRehydrating(true);

    void (async () => {
      try {
        const hydrated = await rehydrateMediaItemByFileId({
          items,
          fileId,
          callTool,
        });
        setItems(hydrated);
        try {
          window.openai?.setWidgetState?.(buildPersistedMediaWidgetState(hydrated));
        } catch {
          // best-effort
        }
      } finally {
        rehydrateInFlightRef.current = false;
        setIsRehydrating(false);
      }
    })();
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
        {isRehydrating
          ? "Loading media preview…"
          : "Media will appear here when generation finishes."}
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
      {isRehydrating ? (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "0 4px" }}>
          Refreshing media preview…
        </div>
      ) : null}
      {items.map((item, index) => (
        <div
          key={mediaItemReactKey(item, index)}
          style={{
            borderRadius: 12,
            overflow: "hidden",
            background: "#0b0f19",
            border: "1px solid #1f2937",
          }}
        >
          {item.previewUrl != null && item.kind === "image" ? (
            <img
              src={item.previewUrl}
              alt={item.label ?? "Generated image"}
              onError={() => {
                onPreviewLoadError(item.fileId);
              }}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          ) : null}
          {item.previewUrl != null && item.kind === "video" ? (
            <video
              src={item.previewUrl}
              controls
              playsInline
              onError={() => {
                onPreviewLoadError(item.fileId);
              }}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          ) : null}
          {item.previewUrl != null && item.kind === "audio" ? (
            <div style={{ padding: 12 }}>
              <audio
                src={item.previewUrl}
                controls
                onError={() => {
                  onPreviewLoadError(item.fileId);
                }}
                style={{ width: "100%" }}
              />
            </div>
          ) : null}
          {item.previewUrl == null || item.kind === "file" ? (
            <div style={{ padding: 12, color: "#e5e7eb", fontSize: 14 }}>
              {item.previewUrl == null
                ? isRehydrating
                  ? "Loading preview…"
                  : "Preview unavailable. Open in VideoGen to view this file."
                : "Preview unavailable for this file type."}
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
            {item.appMediaUrl != null ? (
              <button
                type="button"
                onClick={() => {
                  const appMediaUrl = item.appMediaUrl;
                  if (appMediaUrl == null) {
                    return;
                  }

                  // Never open signed storage URLs here — ChatGPT appends query
                  // params and breaks the signature. Open the in-app Media modal.
                  openUrl(appMediaUrl);
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
                Open in VideoGen
              </button>
            ) : null}
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
