export type ChatgptAttachment = {
  fileId: string;
  downloadUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
};

export type WidgetToolResult = {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

export type UploadBytesResult =
  | { ok: true; fileId: string }
  | { ok: false; message: string };

type PresignedPutInit = { method: "PUT"; body: ArrayBuffer };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * ChatGPT serves attachment bytes from its own CDN. The widget may fetch those
 * URLs in the browser. The MCP server must not: the URL is caller-supplied.
 * Keep this host check aligned with `UPLOAD_WIDGET_CSP.connectDomains`.
 */
export function isAllowedChatgptAttachmentDownloadUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname;

  return hostname === "oaiusercontent.com" || hostname.endsWith(".oaiusercontent.com");
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function readAttachment(value: unknown): ChatgptAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const fileId = readOptionalString(value, "file_id");

  if (fileId == null) {
    return null;
  }

  const rawDownloadUrl = readOptionalString(value, "download_url");
  const downloadUrl =
    rawDownloadUrl != null && isAllowedChatgptAttachmentDownloadUrl(rawDownloadUrl)
      ? rawDownloadUrl
      : null;

  return {
    fileId,
    downloadUrl,
    fileName: readOptionalString(value, "file_name"),
    mimeType: readOptionalString(value, "mime_type"),
  };
}

/** Reads `open_uploader` arguments. Drops attachments that have no ChatGPT file id. */
export function readChatgptAttachments(toolInput: unknown): ChatgptAttachment[] {
  if (!isRecord(toolInput) || !Array.isArray(toolInput.files)) {
    return [];
  }

  const attachments: ChatgptAttachment[] = [];

  for (const entry of toolInput.files) {
    const attachment = readAttachment(entry);

    if (attachment != null) {
      attachments.push(attachment);
    }
  }

  return attachments;
}

export function readFreshDownloadUrl(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const downloadUrl = readOptionalString(value, "downloadUrl");

  if (downloadUrl == null || !isAllowedChatgptAttachmentDownloadUrl(downloadUrl)) {
    return null;
  }

  return downloadUrl;
}

function readString(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readOptionalString(payload, key);
}

function readToolPayload(result: WidgetToolResult): unknown {
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
      return textItem.text;
    }
  }

  return null;
}

function readErrorMessage(result: WidgetToolResult): string {
  const textItem = result.content?.find(
    (item) => item.type === "text" && typeof item.text === "string",
  );

  return textItem?.text ?? "Something went wrong while uploading. Please try again.";
}

/**
 * Reserves a VideoGen file only after the bytes are already in memory, then
 * PUTs those bytes with no Content-Type header. A browser `File` body would
 * set Content-Type to the file's MIME type, which does not match an R2 URL
 * signed without a content type.
 */
export async function uploadBytesToVideoGen({
  bytes,
  displayName,
  callTool,
  putBytes,
}: {
  bytes: ArrayBuffer;
  displayName: string;
  callTool: (name: string, args: Record<string, unknown>) => Promise<WidgetToolResult>;
  putBytes: (uploadUrl: string, init: PresignedPutInit) => Promise<{ ok: boolean; status: number }>;
}): Promise<UploadBytesResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, message: "The file was empty. Choose the photo again." };
  }

  const created = await callTool("create_file_upload", { displayName });

  if (created.isError === true) {
    return { ok: false, message: readErrorMessage(created) };
  }

  const createdPayload = readToolPayload(created);
  const uploadUrl = readString(createdPayload, "uploadUrl");
  const fileId = readString(createdPayload, "fileId");

  if (uploadUrl == null || fileId == null) {
    return { ok: false, message: "The upload could not be started. Please try again." };
  }

  const putResponse = await putBytes(uploadUrl, { method: "PUT", body: bytes });

  if (!putResponse.ok) {
    return { ok: false, message: `Upload failed (HTTP ${putResponse.status}). Please try again.` };
  }

  const ready = await callTool("get_file", { fileId, wait: true });

  if (ready.isError === true) {
    return { ok: false, message: readErrorMessage(ready) };
  }

  return { ok: true, fileId };
}
