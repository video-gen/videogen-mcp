import { StrictMode, useCallback, useRef, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

/**
 * The VideoGen upload widget: a ChatGPT App component rendered in a sandboxed
 * iframe alongside the assistant's reply. It exists so a ChatGPT user can attach
 * a file WITHOUT the model ever seeing a raw upload URL.
 *
 * Flow (all client-side; the server never fetches a caller-supplied URL, so there
 * is no SSRF surface):
 *   1. The user picks a file (native picker / drag-drop) inside the iframe.
 *   2. We call the `create_file_upload` MCP tool via the host bridge
 *      (`window.openai.callTool`) to get `{ fileId, uploadUrl }`. The `uploadUrl`
 *      stays inside this iframe — it is never returned to the model.
 *   3. We PUT the raw bytes straight to `uploadUrl` (a short-lived pre-signed
 *      storage URL, so no Authorization header).
 *   4. We call `get_file` with `{ wait: true }` so the server polls until the
 *      file finishes processing.
 *   5. We hand the resulting `fileId` back to the model via `setWidgetState` +
 *      `sendFollowUpMessage` so it can use it in workflows, tools, logos, or
 *      B-roll.
 *
 * `window.openai` is a ChatGPT extension, so every call is feature-detected: on a
 * host without it the widget explains that `upload_file` / `create_file_upload`
 * should be used instead.
 */

type ToolResultContent = { type?: string; text?: string };

type ToolResult = {
  content?: ToolResultContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

type OpenAiHost = {
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  setWidgetState?: (state: Record<string, unknown>) => Promise<void> | void;
  sendFollowUpMessage?: (args: { prompt: string }) => Promise<void> | void;
};

declare global {
  interface Window {
    openai?: OpenAiHost;
  }
}

type UploadPhase = "idle" | "creating" | "uploading" | "processing" | "done" | "error";

const ACCENT = "#2563eb";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Reads a tool result's payload. Our MCP tools return their JSON as a text
 * content block (see `jsonResult`), so prefer `structuredContent` when a host
 * provides it and otherwise parse the first text block.
 */
function readToolPayload(result: ToolResult): unknown {
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

function readString(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Best-effort human message from a tool error result. */
function readErrorMessage(result: ToolResult): string {
  const textItem = result.content?.find(
    (item) => item.type === "text" && typeof item.text === "string",
  );

  return textItem?.text ?? "Something went wrong while uploading. Please try again.";
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
  const [fileId, setFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File): Promise<void> => {
    const host = window.openai;

    if (host?.callTool == null) {
      setPhase("error");
      setErrorMessage(
        "In-chat upload is only available in ChatGPT. On other clients, use the upload_file or create_file_upload tools instead.",
      );

      return;
    }

    setFileName(file.name);
    setFileId(null);
    setErrorMessage(null);

    try {
      setPhase("creating");

      const created = await host.callTool("create_file_upload", { displayName: file.name });

      if (created.isError === true) {
        setPhase("error");
        setErrorMessage(readErrorMessage(created));

        return;
      }

      const createdPayload = readToolPayload(created);
      const uploadUrl = readString(createdPayload, "uploadUrl");
      const newFileId = readString(createdPayload, "fileId");

      if (uploadUrl == null || newFileId == null) {
        setPhase("error");
        setErrorMessage("The upload could not be started. Please try again.");

        return;
      }

      setPhase("uploading");

      const putResponse = await fetch(uploadUrl, { method: "PUT", body: file });

      if (!putResponse.ok) {
        setPhase("error");
        setErrorMessage(`Upload failed (HTTP ${putResponse.status}). Please try again.`);

        return;
      }

      setPhase("processing");

      const ready = await host.callTool("get_file", { fileId: newFileId, wait: true });

      if (ready.isError === true) {
        setPhase("error");
        setErrorMessage(readErrorMessage(ready));

        return;
      }

      setFileId(newFileId);
      setPhase("done");

      await host.setWidgetState?.({ fileId: newFileId, displayName: file.name, status: "ready" });
      await host.sendFollowUpMessage?.({
        prompt: `I uploaded the file "${file.name}" to VideoGen. Its file id is ${newFileId}. Use this file id for the next step.`,
      });
    } catch {
      setPhase("error");
      setErrorMessage("Something went wrong while uploading. Please try again.");
    }
  }, []);

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.currentTarget.files?.[0];

      if (file != null) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];

      if (file != null) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const isBusy = phase === "creating" || phase === "uploading" || phase === "processing";

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
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
        style={{
          border: `2px dashed ${isDragging ? ACCENT : "#d1d5db"}`,
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          cursor: isBusy ? "default" : "pointer",
          background: isDragging ? "#eff6ff" : "#f9fafb",
          transition: "border-color 120ms, background 120ms",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={onInputChange}
          disabled={isBusy}
        />

        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {fileName ?? "Upload a file to VideoGen"}
        </div>

        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {phase === "idle"
            ? "Click to choose a file or drag and drop it here."
            : phase === "error"
              ? "Click to choose another file."
              : PHASE_LABEL[phase]}
        </div>
      </div>

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

      {phase === "done" && fileId != null ? (
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
          Uploaded. File id: <code style={{ fontWeight: 600 }}>{fileId}</code>
        </div>
      ) : null}

      {phase === "error" && errorMessage != null ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
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
