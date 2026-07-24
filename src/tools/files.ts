import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getHydratedFile, uploadFile } from "@videogen/sdk";
import { z } from "zod";
import type { McpExecutionMode } from "../buildServer";
import type { GetVideoGenClient } from "../client";
import { type McpOperations, dropUndefined, extractControls } from "../operations";
import { errorResult } from "../result";
import { cursorField, limitField } from "../schemas";

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
): void {
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
      uploadFile(getClient(), {
        data: bytes,
        displayName,
        ...(type != null ? { type } : {}),
      }),
    );

  // The SDK `uploadFile` helper accepts only these three types; leave PDF /
  // SLIDESHOW to `create_file_upload` (or omit the type and let it be inferred).
  const uploadFileTypeField = z
    .enum(["IMAGE", "VIDEO", "AUDIO"])
    .optional()
    .describe("File type. Inferred when omitted.");

  if (executionMode === "LOCAL") {
    // On stdio the server runs on the caller's own machine, so it can read the
    // source straight from the local filesystem by path.
    server.registerTool(
      "upload_file",
      {
        title: "Upload file",
        description:
          "Upload a local file to VideoGen and wait until it is processed. Returns the file with its id (vg_file_...) and signed URLs. Use the returned fileId for voiceover_to_video, slideshow_to_video, logos, or B-roll. To upload a remote asset, download it first and pass its local path.",
        inputSchema: {
          filePath: z.string().describe("Absolute path to a local file to upload."),
          displayName: z
            .string()
            .optional()
            .describe("Display name for the file. Defaults to the source file name."),
          type: uploadFileTypeField,
        },
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
        inputSchema: {
          fileData: z.string().describe("Base64-encoded contents of the file to upload."),
          displayName: z
            .string()
            .optional()
            .describe("Display name for the file. Defaults to 'upload'."),
          type: uploadFileTypeField,
        },
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
      inputSchema: {
        displayName: z.string().describe("Display name for the file."),
        type: z
          .enum(["IMAGE", "VIDEO", "AUDIO", "PDF", "SLIDESHOW"])
          .optional()
          .describe("File type. Inferred after processing when omitted."),
        isTemporary: z
          .boolean()
          .optional()
          .describe(
            "When true, the file is temporary (guaranteed available for 24 hours, not analyzed for search). Defaults to false.",
          ),
      },
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
      inputSchema: {
        fileId: z.string().describe("File id (vg_file_...)."),
        wait: z
          .boolean()
          .optional()
          .describe(
            "When true, poll until the file finishes processing and a rendition is ready. Defaults to false (a single fetch).",
          ),
        pollIntervalMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("How often to poll while waiting, in milliseconds."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum time to wait for processing before giving up, in milliseconds."),
      },
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

      return await respondSdk(() => getHydratedFile(getClient(), args.fileId));
    },
  );

  server.registerTool(
    "list_files",
    {
      title: "List files",
      description: "List files visible to the current API key.",
      inputSchema: { cursor: cursorField, limit: limitField },
    },
    async (args) => await respondSdk(() => getClient().files.getFiles(dropUndefined(args))),
  );
}
