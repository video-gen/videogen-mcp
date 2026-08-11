/**
 * Pure helpers for the ChatGPT media-preview widget: extract media from tool
 * payloads, merge with persisted widget state, and rehydrate missing preview
 * URLs via `get_file`.
 *
 * Kept free of React so node:test can cover refresh / rehydrate behavior.
 */

export type MediaKind = "image" | "video" | "audio" | "file";

export type MediaItem = {
  kind: MediaKind;
  /**
   * Signed URL for in-iframe `<img>` / `<audio>` / `<video>` only.
   * Null when the host refreshed without download URLs — rehydrate via get_file.
   */
  previewUrl: string | null;
  /** Absolute VideoGen `/media?storageFileId=…` URL for the Open button. */
  appMediaUrl: string | null;
  fileId: string | null;
  label: string | null;
};

export type MediaPreviewWidgetStateV1 = {
  v: 1;
  items: MediaItem[];
};

export type CallToolFn = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}>;

const WIDGET_STATE_VERSION = 1 as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function classifyType(fileType: string | null): MediaKind {
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

function mediaItemKey(item: MediaItem): string {
  return item.fileId ?? item.previewUrl ?? item.appMediaUrl ?? item.label ?? item.kind;
}

function pushMediaItem({
  items,
  previewUrl,
  appMediaUrl,
  fileId,
  fileType,
  label,
}: {
  items: MediaItem[];
  previewUrl: string | null;
  appMediaUrl: string | null;
  fileId: string | null;
  fileType: string | null;
  label: string | null;
}): void {
  // Keep fileId / appMediaUrl rows even without a preview URL so refresh can
  // rehydrate via get_file instead of showing the empty placeholder.
  if (previewUrl == null && appMediaUrl == null && fileId == null) {
    return;
  }

  items.push({
    kind: classifyType(fileType),
    previewUrl,
    appMediaUrl,
    fileId,
    label,
  });
}

/**
 * Pulls previewable media out of MCP tool shapes: ExecutedTool (`results[]`),
 * FileInfo, and ProjectExport.
 */
export function extractMediaItems(payload: unknown): MediaItem[] {
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
      const previewUrl =
        readString(result.downloadUrl) ??
        readString(result.thumbnailUrl) ??
        (nestedFile != null
          ? (readString(nestedFile.downloadUrl) ?? readString(nestedFile.thumbnailUrl))
          : null);
      const fileId =
        readString(result.fileId) ?? (nestedFile != null ? readString(nestedFile.fileId) : null);
      const appMediaUrl =
        readString(result.appMediaUrl) ??
        (nestedFile != null ? readString(nestedFile.appMediaUrl) : null);

      pushMediaItem({
        items,
        previewUrl,
        appMediaUrl,
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
      previewUrl: readString(payload.downloadUrl) ?? readString(payload.thumbnailUrl),
      appMediaUrl: readString(payload.appMediaUrl),
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
      previewUrl:
        readString(payload.downloadUrl) ??
        readString(payload.thumbnailUrl) ??
        (nestedFile != null
          ? (readString(nestedFile.downloadUrl) ?? readString(nestedFile.thumbnailUrl))
          : null),
      appMediaUrl:
        readString(payload.appMediaUrl) ??
        (nestedFile != null ? readString(nestedFile.appMediaUrl) : null),
      fileId:
        readString(payload.exportFileId) ??
        (nestedFile != null ? readString(nestedFile.fileId) : null),
      fileType: nestedFile != null ? readString(nestedFile.type) : "VIDEO",
      label: "Export",
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = mediaItemKey(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

export function resolveToolOutputPayload(toolOutput: unknown): unknown {
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

export function readStructuredContent(message: unknown): unknown {
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

function isMediaItem(value: unknown): value is MediaItem {
  if (!isRecord(value)) {
    return false;
  }

  const kind = value.kind;
  if (kind !== "image" && kind !== "video" && kind !== "audio" && kind !== "file") {
    return false;
  }

  return (
    (value.previewUrl == null || typeof value.previewUrl === "string") &&
    (value.appMediaUrl == null || typeof value.appMediaUrl === "string") &&
    (value.fileId == null || typeof value.fileId === "string") &&
    (value.label == null || typeof value.label === "string")
  );
}

/** Reads persisted media items from ChatGPT `widgetState` (message-scoped). */
export function readPersistedMediaItems(widgetState: unknown): MediaItem[] {
  if (!isRecord(widgetState) || widgetState.v !== WIDGET_STATE_VERSION) {
    return [];
  }

  if (!Array.isArray(widgetState.items)) {
    return [];
  }

  return widgetState.items.filter(isMediaItem);
}

export function buildPersistedMediaWidgetState(items: MediaItem[]): MediaPreviewWidgetStateV1 {
  return { v: WIDGET_STATE_VERSION, items };
}

/**
 * Prefer tool-output rows; fill missing preview URLs from persisted state by
 * fileId. If tool output has nothing, fall back to persisted items entirely
 * (ChatGPT refresh often strips signed download URLs from toolOutput).
 */
export function mergeMediaItemsWithPersistedState({
  fromToolOutput,
  fromWidgetState,
}: {
  fromToolOutput: MediaItem[];
  fromWidgetState: MediaItem[];
}): MediaItem[] {
  if (fromToolOutput.length === 0) {
    return fromWidgetState;
  }

  const persistedByFileId = new Map<string, MediaItem>();
  for (const item of fromWidgetState) {
    if (item.fileId != null) {
      persistedByFileId.set(item.fileId, item);
    }
  }

  return fromToolOutput.map((item) => {
    if (item.previewUrl != null || item.fileId == null) {
      return item;
    }

    const cached = persistedByFileId.get(item.fileId);
    if (cached == null) {
      return item;
    }

    return {
      ...item,
      previewUrl: cached.previewUrl,
      appMediaUrl: item.appMediaUrl ?? cached.appMediaUrl,
      label: item.label ?? cached.label,
      kind: item.kind !== "file" ? item.kind : cached.kind,
    };
  });
}

export function getMediaItemsNeedingRehydrate(items: MediaItem[]): MediaItem[] {
  return items.filter((item) => item.previewUrl == null && item.fileId != null);
}

function readToolPayload(result: {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
}): unknown {
  if (result.structuredContent != null) {
    return result.structuredContent;
  }

  const textItem = result.content?.find(
    (item) => item.type === "text" && typeof item.text === "string",
  );

  if (textItem?.text != null) {
    try {
      return JSON.parse(textItem.text);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Calls `get_file` for rows that have a fileId but no preview URL, returning
 * a new list with fresh signed download / thumbnail URLs.
 */
export async function rehydrateMediaItems({
  items,
  callTool,
}: {
  items: MediaItem[];
  callTool: CallToolFn;
}): Promise<MediaItem[]> {
  const needsRehydrate = getMediaItemsNeedingRehydrate(items);
  if (needsRehydrate.length === 0) {
    return items;
  }

  const hydratedByFileId = new Map<string, MediaItem>();

  await Promise.all(
    needsRehydrate.map(async (item) => {
      const fileId = item.fileId;
      if (fileId == null) {
        return;
      }

      try {
        const result = await callTool("get_file", { fileId });
        if (result.isError === true) {
          return;
        }

        const payload = readToolPayload(result);
        const hydratedItems = extractMediaItems(payload);
        const hydrated = hydratedItems.find((candidate) => candidate.fileId === fileId) ??
          hydratedItems[0];

        if (hydrated == null) {
          return;
        }

        hydratedByFileId.set(fileId, {
          ...item,
          previewUrl: hydrated.previewUrl ?? item.previewUrl,
          appMediaUrl: hydrated.appMediaUrl ?? item.appMediaUrl,
          label: item.label ?? hydrated.label,
          kind: item.kind !== "file" ? item.kind : hydrated.kind,
          fileId,
        });
      } catch {
        // Keep the fileId / Open link; preview stays empty.
      }
    }),
  );

  if (hydratedByFileId.size === 0) {
    return items;
  }

  return items.map((item) => {
    if (item.fileId == null) {
      return item;
    }

    return hydratedByFileId.get(item.fileId) ?? item;
  });
}

/** Rehydrate a single file after a media element fails to load (expired URL). */
export async function rehydrateMediaItemByFileId({
  items,
  fileId,
  callTool,
}: {
  items: MediaItem[];
  fileId: string;
  callTool: CallToolFn;
}): Promise<MediaItem[]> {
  const withoutPreview = items.map((item) =>
    item.fileId === fileId ? { ...item, previewUrl: null } : item,
  );

  return await rehydrateMediaItems({ items: withoutPreview, callTool });
}
