import { StrictMode, useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  isAllowedChatgptAttachmentDownloadUrl,
  readChatgptAttachments,
  readFreshDownloadUrl,
  uploadBytesToVideoGen,
  type ChatgptAttachment,
} from "../src/chatgptAttachmentFiles";

/**
 * The VideoGen upload widget: a ChatGPT App component rendered in a sandboxed
 * iframe alongside the assistant's reply. It exists so a ChatGPT user can attach
 * a file WITHOUT the model ever seeing a raw upload URL.
 *
 * Flow (all client-side; the server never fetches a caller-supplied URL, so there
 * is no SSRF surface):
 *   1. The user picks a file, or the model passes ChatGPT attachments in `files`.
 *   2. Attachment bytes are fetched in this iframe from ChatGPT's CDN, or read
 *      from the picked file.
 *   3. We call `create_file_upload` via `window.openai.callTool` to get
 *      `{ fileId, uploadUrl }`. The `uploadUrl` stays inside this iframe.
 *   4. We PUT the raw bytes (no Content-Type) straight to `uploadUrl`.
 *   5. We call `get_file` with `{ wait: true }` until processing finishes.
 *   6. We hand the `fileId` back via `setWidgetState` + `sendFollowUpMessage`.
 *
 * The file input is an overlay, not `display: none`. iOS Safari ignores a
 * programmatic click on a hidden file input, so the tap has to hit the input
 * itself. When the host offers `selectFiles`, that picker is used instead.
 */

type UploadPhase = "idle" | "creating" | "uploading" | "processing" | "done" | "error";

type UploadedFile = { fileId: string; displayName: string };

const ACCENT = "#2563eb";
const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

const importedChatgptFileIds = new Set<string>();

function readToolInputFromGlobalsEvent(event: Event): unknown {
  if (!("detail" in event)) {
    return undefined;
  }

  const detail = event.detail;

  if (typeof detail !== "object" || detail == null || !("globals" in detail)) {
    return undefined;
  }

  const globals = detail.globals;

  if (typeof globals !== "object" || globals == null || !("toolInput" in globals)) {
    return undefined;
  }

  return globals.toolInput;
}

const PHASE_LABEL: Record<Exclude<UploadPhase, "idle" | "error">, string> = {
  creating: "Preparing upload...",
  uploading: "Uploading file...",
  processing: "Processing file...",
  done: "Upload complete",
};

function UploadWidget(): ReactElement {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inFlightRef = useRef(false);

  const putBytes = useCallback(async (uploadUrl: string, init: { method: "PUT"; body: ArrayBuffer }) => {
    const response = await fetch(uploadUrl, init);

    return { ok: response.ok, status: response.status };
  }, []);

  const uploadOne = useCallback(
    async ({
      bytes,
      displayName,
    }: {
      bytes: ArrayBuffer;
      displayName: string;
    }): Promise<UploadedFile | { message: string }> => {
      const host = window.openai;

      if (host?.callTool == null) {
        return {
          message:
            "In-chat upload is only available in ChatGPT. On other clients, use the upload_file or create_file_upload tools instead.",
        };
      }

      const result = await uploadBytesToVideoGen({
        bytes,
        displayName,
        callTool: host.callTool,
        putBytes,
      });

      if (!result.ok) {
        return { message: result.message };
      }

      return { fileId: result.fileId, displayName };
    },
    [putBytes],
  );

  const finishUploads = useCallback(async (uploaded: UploadedFile[], failureMessage: string | null) => {
    const host = window.openai;

    if (uploaded.length === 0) {
      setPhase("error");
      setErrorMessage(failureMessage ?? "Something went wrong while uploading. Please try again.");

      return;
    }

    const ids = uploaded.map((file) => file.fileId);
    const first = uploaded[0];

    setFileIds(ids);
    setPhase("done");
    setErrorMessage(
      failureMessage == null ? null : `${uploaded.length} uploaded. ${failureMessage}`,
    );

    if (first == null) {
      return;
    }

    await host?.setWidgetState?.({
      fileId: first.fileId,
      fileIds: ids,
      displayName: first.displayName,
      status: "ready",
    });

    const listed = uploaded.map((file) => `${file.displayName}: ${file.fileId}`).join("\n");

    await host?.sendFollowUpMessage?.({
      prompt: `Uploaded ${uploaded.length} file(s) to VideoGen.\n${listed}\nUse these file ids for the next step.`,
    });
  }, []);

  const uploadByteGroups = useCallback(
    async (groups: Array<{ bytes: ArrayBuffer; displayName: string }>): Promise<void> => {
      if (groups.length === 0) {
        return;
      }

      setFileIds([]);
      setErrorMessage(null);
      setFileName(groups.length === 1 ? (groups[0]?.displayName ?? null) : `${groups.length} files`);
      setPhase("uploading");

      try {
        const results = await Promise.all(groups.map((group) => uploadOne(group)));
        const uploaded: UploadedFile[] = [];
        let failureMessage: string | null = null;

        for (const result of results) {
          if ("fileId" in result) {
            uploaded.push(result);
          } else if (failureMessage == null) {
            failureMessage = result.message;
          }
        }

        await finishUploads(uploaded, failureMessage);
      } catch {
        setPhase("error");
        setErrorMessage("Something went wrong while uploading. Please try again.");
      }
    },
    [finishUploads, uploadOne],
  );

  const downloadAttachment = useCallback(async (attachment: ChatgptAttachment): Promise<ArrayBuffer | null> => {
    const host = window.openai;
    let downloadUrl = attachment.downloadUrl;

    if (host?.getFileDownloadUrl != null) {
      try {
        const fresh = await host.getFileDownloadUrl({ fileId: attachment.fileId });
        const freshUrl = readFreshDownloadUrl(fresh);

        if (freshUrl != null) {
          downloadUrl = freshUrl;
        }
      } catch {
        downloadUrl = attachment.downloadUrl;
      }
    }

    if (downloadUrl == null || !isAllowedChatgptAttachmentDownloadUrl(downloadUrl)) {
      return null;
    }

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      return null;
    }

    const bytes = await response.arrayBuffer();

    return bytes.byteLength > 0 ? bytes : null;
  }, []);

  const importAttachments = useCallback(
    async (attachments: ChatgptAttachment[]): Promise<void> => {
      if (attachments.length === 0 || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      setPhase("creating");
      setFileName(attachments.length === 1 ? (attachments[0]?.fileName ?? "photo") : `${attachments.length} files`);
      setErrorMessage(null);

      try {
        const downloaded = await Promise.all(
          attachments.map(async (attachment) => {
            const bytes = await downloadAttachment(attachment);

            return { attachment, bytes };
          }),
        );

        const ready: Array<{ bytes: ArrayBuffer; displayName: string }> = [];

        for (const item of downloaded) {
          if (item.bytes == null) {
            importedChatgptFileIds.delete(item.attachment.fileId);
            continue;
          }

          ready.push({
            bytes: item.bytes,
            displayName: item.attachment.fileName ?? "photo",
          });
        }

        if (ready.length === 0) {
          for (const attachment of attachments) {
            importedChatgptFileIds.delete(attachment.fileId);
          }

          setPhase("error");
          setErrorMessage("Couldn't download the attached photo. Choose it below.");

          return;
        }

        await uploadByteGroups(ready);
      } catch {
        for (const attachment of attachments) {
          importedChatgptFileIds.delete(attachment.fileId);
        }

        setPhase("error");
        setErrorMessage("Couldn't download the attached photo. Choose it below.");
      } finally {
        inFlightRef.current = false;
      }
    },
    [downloadAttachment, uploadByteGroups],
  );

  useEffect(() => {
    const startFromInput = (toolInput: unknown): void => {
      const pending = readChatgptAttachments(toolInput).filter(
        (attachment) => !importedChatgptFileIds.has(attachment.fileId),
      );

      if (pending.length === 0 || inFlightRef.current) {
        return;
      }

      for (const attachment of pending) {
        importedChatgptFileIds.add(attachment.fileId);
      }

      void importAttachments(pending);
    };

    const onSetGlobals = (event: Event): void => {
      startFromInput(readToolInputFromGlobalsEvent(event) ?? window.openai?.toolInput);
    };

    window.addEventListener(SET_GLOBALS_EVENT_TYPE, onSetGlobals);

    startFromInput(window.openai?.toolInput);

    return () => {
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, onSetGlobals);
    };
  }, [importAttachments]);

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const files = event.currentTarget.files;

      if (files == null || files.length === 0 || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;

      void (async () => {
        const groups = await Promise.all(
          Array.from(files).map(async (file) => ({
            bytes: await file.arrayBuffer(),
            displayName: file.name,
          })),
        );

        await uploadByteGroups(groups);
      })().finally(() => {
        inFlightRef.current = false;
      });
    },
    [uploadByteGroups],
  );

  const onSelectFiles = useCallback(async (): Promise<void> => {
    const selectFiles = window.openai?.selectFiles;

    if (selectFiles == null) {
      return;
    }

    let selected: Awaited<ReturnType<typeof selectFiles>> | null = null;

    try {
      selected = await selectFiles();
    } catch {
      selected = null;
    }

    if (selected == null) {
      setPhase("error");
      setErrorMessage("Couldn't open the photo picker. Try again.");

      return;
    }

    if (inFlightRef.current) {
      return;
    }

    const attachments: ChatgptAttachment[] = [];

    for (const file of selected) {
      if (file.fileId.length === 0 || importedChatgptFileIds.has(file.fileId)) {
        continue;
      }

      importedChatgptFileIds.add(file.fileId);
      attachments.push({
        fileId: file.fileId,
        downloadUrl: null,
        fileName: file.fileName != null && file.fileName.length > 0 ? file.fileName : null,
        mimeType: file.mimeType != null && file.mimeType.length > 0 ? file.mimeType : null,
      });
    }

    await importAttachments(attachments);
  }, [importAttachments]);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>): void => {
      event.preventDefault();
      setIsDragging(false);

      const files = event.dataTransfer.files;

      if (files.length === 0 || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      event.stopPropagation();

      void (async () => {
        const groups = await Promise.all(
          Array.from(files).map(async (file) => ({
            bytes: await file.arrayBuffer(),
            displayName: file.name,
          })),
        );

        await uploadByteGroups(groups);
      })().finally(() => {
        inFlightRef.current = false;
      });
    },
    [uploadByteGroups],
  );

  const isBusy = phase === "creating" || phase === "uploading" || phase === "processing";
  const canSelectFiles = typeof window !== "undefined" && window.openai?.selectFiles != null;

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: "#111827",
        padding: 16,
        maxWidth: 520,
      }}
    >
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          position: "relative",
          display: "block",
          border: `2px dashed ${isDragging ? ACCENT : "#d1d5db"}`,
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          cursor: isBusy ? "default" : "pointer",
          background: isDragging ? "#eff6ff" : "#f9fafb",
          transition: "border-color 120ms, background 120ms",
        }}
      >
        {canSelectFiles ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              void onSelectFiles();
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        ) : (
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*,application/pdf"
            disabled={isBusy}
            onChange={onInputChange}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              fontSize: 16,
            }}
          />
        )}

        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {fileName ?? "Upload a file to VideoGen"}
        </div>

        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {phase === "idle"
            ? "Choose a file, or drag and drop it here."
            : phase === "error"
              ? "Choose another file."
              : PHASE_LABEL[phase]}
        </div>
      </label>

      {isBusy ? (
        <div
          style={{
            marginTop: 12,
            height: 4,
            borderRadius: 2,
            background: "#e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "40%",
              height: "100%",
              background: ACCENT,
              borderRadius: 2,
              animation: "vg-indeterminate 1.1s ease-in-out infinite",
            }}
          />
        </div>
      ) : null}

      {phase === "done" && fileIds.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#ecfdf5",
            color: "#065f46",
            fontSize: 13,
          }}
        >
          Uploaded. File id{fileIds.length > 1 ? "s" : ""}:{" "}
          <code style={{ fontWeight: 600 }}>{fileIds.join(", ")}</code>
        </div>
      ) : null}

      {errorMessage != null ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: phase === "error" ? "#fef2f2" : "#ecfdf5",
            color: phase === "error" ? "#991b1b" : "#065f46",
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <style>
        {
          "@keyframes vg-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }"
        }
      </style>
    </div>
  );
}

const container = document.getElementById("videogen-upload-root");

if (container != null) {
  createRoot(container).render(
    <StrictMode>
      <UploadWidget />
    </StrictMode>,
  );
}
