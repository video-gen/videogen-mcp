import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getHydratedFile, uploadFile } from "@videogen/sdk";
import { z } from "zod";
import type { McpExecutionMode } from "../buildServer";
import { MEDIA_PREVIEW_TOOL_META } from "../appWidget";
import type { GetVideoGenClient } from "../client";
import {
  createFileUploadInputSchema,
  getFileInputSchema,
  listFilesInputSchema,
  uploadFileHostedInputSchema,
  uploadFileLocalInputSchema,
} from "../inputSchemas";
import {
  type McpOperations,
  HOSTED_PROXY_SAFE_MAX_WAIT_MS,
  dropUndefined,
  extractControls,
} from "../operations";
import {
  fileOutputSchema,
  fileUploadOutputSchema,
  listFilesOutputSchema,
} from "../outputSchemas";
import { errorResult } from "../result";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PRIVATE_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

/**
 * Upper bound on the decoded size of an inline (base64) upload on the HOSTED
 * server. Inline bytes travel through the MCP host's context window, so this is
 * for small assets (images, logos, short audio) — larger files should be
 * uploaded through `create_file_upload` (pre-signed URL + client-side PUT) and
 * referenced by id. Kept below the HTTP transport's ~4MB body cap (base64
 * inflates by ~33%) so this friendly error fires before the transport rejects
 * the raw body with a generic size error.
 */
const MAX_INLINE_UPLOAD_BYTES = 2 * 1024 * 1024;

const fileSourceStatusSchema = z.object({ status: z.string().optional() }).nullish();

const readyFileSchema = z.object({
  downloadSource: fileSourceStatusSchema,
  previewSource: fileSourceStatusSchema,
});

/**
 * A freshly uploaded file is usable once any downloadable or preview rendition
 * has finished processing. Mirrors the readiness check the SDK's `uploadFile`
 * helper uses after PUTting bytes.
 */
function fileHasReadySource(snapshot: unknown): boolean {
  const result = readyFileSchema.safeParse(snapshot);

  if (!result.success) {
    return false;
  }

  return (
    result.data.downloadSource?.status === "ready" || result.data.previewSource?.status === "ready"
  );
}

export function registerFileTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  executionMode: McpExecutionMode,
  { respondSdk, awaitReady, toErrorResult }: McpOperations,
  mediaPreviewMeta: typeof MEDIA_PREVIEW_TOOL_META | null,
): void {
  const mediaPreviewToolFields =
    mediaPreviewMeta != null ? { _meta: mediaPreviewMeta } : {};

  const finalizeUpload = async ({
    bytes,
    displayName,
    type,
  }: {
    bytes: Uint8Array;
    displayName: string;
    type: "IMAGE" | "VIDEO" | "AUDIO" | undefined;
  }): Promise<CallToolResult> =>
    await respondSdk(() =>
      uploadFile({
        client: getClient(),
        data: bytes,
        displayName,
        ...(type != null ? { type } : {}),
        // Hosted MCP sits behind Cloudflare's ~100s proxy read timeout. Cap the
        // SDK's post-PUT poll so we fail with a clear error instead of a 524.
        ...(executionMode === "HOSTED" ? { timeoutMs: HOSTED_PROXY_SAFE_MAX_WAIT_MS } : {}),
      }),
    );

  if (executionMode === "LOCAL") {
    // On stdio the server runs on the caller's own machine, so it can read the
    // source straight from the local filesystem by path.
    server.registerTool(
      "upload_file",
      {
        title: "Upload file",
        description:
          "Upload a local file to VideoGen and wait until it is processed. Returns the file with its id (vg_file_...) and signed URLs. Use the returned fileId for voiceover_to_video, slideshow_to_video, logos, or B-roll. To upload a remote asset, download it first and pass its local path.",
        inputSchema: uploadFileLocalInputSchema,
        outputSchema: fileOutputSchema,
        annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
        ...mediaPreviewToolFields,
      },
      async (args) => {
        if (args.filePath.length === 0) {
          return errorResult("Provide a filePath (absolute path to a local file) to upload.");
        }

        const read = await (async (): Promise<
          { ok: true; bytes: Uint8Array; inferredName: string } | { ok: false; err: unknown }
        > => {
          try {
            const buffer = await readFile(args.filePath);

            return {
              ok: true,
              bytes: new Uint8Array(buffer),
              inferredName: basename(args.filePath),
            };
          } catch (err: unknown) {
            return { ok: false, err };
          }
        })();

        if (!read.ok) {
          return toErrorResult(read.err);
        }

        const displayName =
          args.displayName != null && args.displayName.length > 0
            ? args.displayName
            : read.inferredName;

        return await finalizeUpload({ bytes: read.bytes, displayName, type: args.type });
      },
    );
  } else {
    // On the shared HOSTED server there is no caller filesystem to read from, so
    // small files come in as inline base64 (the only in-band way to move bytes
    // through a remote MCP tool call). This is safe — we accept bytes directly
    // and never fetch a caller-supplied URL — but inline bytes pass through the
    // host's context window, so it is capped to small assets; larger files use
    // `create_file_upload` (pre-signed URL + client-side PUT).
    server.registerTool(
      "upload_file",
      {
        title: "Upload file",
        description:
          "Upload a small file (image, logo, or short audio) to VideoGen by passing its base64-encoded contents, and wait until it is processed. Returns the file with its id (vg_file_...) and signed URLs. Use the returned fileId for voiceover_to_video, slideshow_to_video, logos, or B-roll. For large files, use create_file_upload instead.",
        inputSchema: uploadFileHostedInputSchema,
        outputSchema: fileOutputSchema,
        annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
        ...mediaPreviewToolFields,
      },
      async (args) => {
        if (args.fileData.length === 0) {
          return errorResult("Provide fileData (base64-encoded file contents) to upload.");
        }

        const bytes = new Uint8Array(Buffer.from(args.fileData, "base64"));

        if (bytes.length === 0) {
          return errorResult("fileData could not be decoded. Provide valid base64 file contents.");
        }

        if (bytes.length > MAX_INLINE_UPLOAD_BYTES) {
          return errorResult(
            "This file is too large to upload inline. Use create_file_upload to get a pre-signed URL, PUT the bytes to it, then pass the returned fileId.",
          );
        }

        const displayName =
          args.displayName != null && args.displayName.length > 0 ? args.displayName : "upload";

        return await finalizeUpload({ bytes, displayName, type: args.type });
      },
    );
  }

  // Pre-signed upload: the reliable path for large files and for hosts that can
  // PUT bytes out-of-band (e.g. a code sandbox running curl). Returns
  // { fileId, uploadUrl }; the CLIENT PUTs the raw bytes to `uploadUrl`. We only
  // ever hand out a short-lived URL to our own storage and never fetch a
  // caller-supplied URL ourselves, so there is no SSRF surface.
  server.registerTool(
    "create_file_upload",
    {
      title: "Create file upload",
      description:
        "Start an upload for a large file, or when file bytes cannot be inlined. Returns { fileId, uploadUrl }. PUT the raw file bytes to uploadUrl with NO Authorization header (it is a short-lived pre-signed URL). Then call get_file with { fileId, wait: true } to wait until processing finishes, and pass the returned fileId to workflows, tools, logos, or B-roll. For small files, prefer upload_file.",
      inputSchema: createFileUploadInputSchema,
      outputSchema: fileUploadOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() =>
        getClient().files.createFileUpload(
          dropUndefined({
            displayName: args.displayName,
            type: args.type,
            isTemporary: args.isTemporary,
          }),
        ),
      ),
  );

  server.registerTool(
    "get_file",
    {
      title: "Get file",
      description:
        "Fetch a file by id with freshly hydrated (non-expired) signed URLs for its thumbnail, preview, and download renditions. Set wait: true to poll until the file finishes processing — use this right after PUTting bytes to a create_file_upload URL.",
      inputSchema: getFileInputSchema,
      outputSchema: fileOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      ...mediaPreviewToolFields,
    },
    async (args) => {
      if (args.wait === true) {
        return await awaitReady({
          poll: () => getClient().files.hydrateFile({ fileId: args.fileId }),
          isReady: fileHasReadySource,
          controls: extractControls({
            wait: args.wait,
            pollIntervalMs: args.pollIntervalMs,
            timeoutMs: args.timeoutMs,
          }),
        });
      }

      return await respondSdk(() =>
        getHydratedFile({ client: getClient(), fileId: args.fileId }),
      );
    },
  );

  server.registerTool(
    "list_files",
    {
      title: "List files",
      description: "List files visible to the current API key.",
      inputSchema: listFilesInputSchema,
      outputSchema: listFilesOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().files.getFiles(dropUndefined(args))),
  );
}
