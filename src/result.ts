import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MEDIA_PREVIEW_WIDGET_URI } from "./appWidget";

const errorMessageSchema = z.object({ message: z.string() });
const statusCodeSchema = z.object({ statusCode: z.number() });

const getIsPlainJsonObject = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === "object" && !Array.isArray(value);
};

const getIsRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === "object" && !Array.isArray(value);
};

const readNonEmptyString = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * True when structured content carries at least one signed media URL the
 * ChatGPT media-preview widget can render (or the model can open as a link).
 */
export function getHasInlineMediaUrls(data: unknown): boolean {
  if (!getIsRecord(data)) {
    return false;
  }

  if (readNonEmptyString(data.downloadUrl) != null || readNonEmptyString(data.thumbnailUrl) != null) {
    return true;
  }

  if (getIsRecord(data.file)) {
    if (
      readNonEmptyString(data.file.downloadUrl) != null ||
      readNonEmptyString(data.file.thumbnailUrl) != null
    ) {
      return true;
    }
  }

  const results = data.results;
  if (!Array.isArray(results)) {
    return false;
  }

  for (const result of results) {
    if (!getIsRecord(result)) {
      continue;
    }

    if (
      readNonEmptyString(result.downloadUrl) != null ||
      readNonEmptyString(result.thumbnailUrl) != null
    ) {
      return true;
    }

    if (getIsRecord(result.file)) {
      if (
        readNonEmptyString(result.file.downloadUrl) != null ||
        readNonEmptyString(result.file.thumbnailUrl) != null
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns a text content block for humans/models, and when `data` is a plain
 * object also sets `structuredContent` so it can be validated against the tool's
 * `outputSchema` (required by MCP once an output schema is advertised).
 *
 * When the payload includes media download/thumbnail URLs, also tags the result
 * with the media-preview output template so ChatGPT hosts re-bind the widget.
 */
export function jsonResult(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  if (getIsPlainJsonObject(data)) {
    if (getHasInlineMediaUrls(data)) {
      return {
        content: [{ type: "text", text }],
        structuredContent: data,
        _meta: { "openai/outputTemplate": MEDIA_PREVIEW_WIDGET_URI },
      };
    }

    return { content: [{ type: "text", text }], structuredContent: data };
  }

  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * An error result that also carries an RFC 9728 `WWW-Authenticate` challenge
 * under `_meta["mcp/www_authenticate"]`. This tool-result challenge — NOT a
 * transport-level HTTP 401 — is what triggers ChatGPT Apps' OAuth sign-in UI, so
 * on `/mcp/chatgpt` it must be returned on the CallToolResult itself. The
 * default `/mcp` path instead gates protected tools with HTTP 401 (Cursor /
 * Claude). `resourceMetadataUrl` points at this server's protected-resource
 * metadata so the client can discover the authorization server, and `scopes`
 * advertises what to request.
 *
 * `error` / `errorDescription` are optional (RFC 6750 §3.1 only strictly requires
 * `error` when a presented token was rejected). In practice OpenAI's Apps SDK
 * only launches its sign-in flow when the challenge carries both, so callers that
 * want ChatGPT to prompt for linking should pass them even for a purely-missing
 * credential.
 */
export function authErrorResult({
  message,
  resourceMetadataUrl,
  scopes,
  error,
  errorDescription,
}: {
  message: string;
  resourceMetadataUrl: string;
  scopes: readonly string[];
  error?: string;
  errorDescription?: string;
}): CallToolResult {
  const params = [`resource_metadata="${resourceMetadataUrl}"`];

  if (scopes.length > 0) {
    params.push(`scope="${scopes.join(" ")}"`);
  }

  if (error != null) {
    params.push(`error="${error}"`);
  }

  if (errorDescription != null) {
    params.push(`error_description="${errorDescription}"`);
  }

  const challenge = `Bearer ${params.join(", ")}`;

  return {
    content: [{ type: "text", text: message }],
    isError: true,
    _meta: { "mcp/www_authenticate": [challenge] },
  };
}

/** Extracts the HTTP status code from an SDK error, or null for non-HTTP errors. */
export function getErrorStatusCode(err: unknown): number | null {
  const result = statusCodeSchema.safeParse(err);

  return result.success ? result.data.statusCode : null;
}

export function getErrorMessage(err: unknown): string {
  if (typeof err === "string" && err.length > 0) {
    return err;
  }

  if (err instanceof Error && err.message.length > 0) {
    return err.message;
  }

  const result = errorMessageSchema.safeParse(err);
  if (result.success && result.data.message.length > 0) {
    return result.data.message;
  }

  return "The VideoGen MCP server encountered an unexpected error.";
}
