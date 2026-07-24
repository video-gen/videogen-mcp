import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const errorMessageSchema = z.object({ message: z.string() });
const statusCodeSchema = z.object({ statusCode: z.number() });

export function jsonResult(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * An error result that also carries an RFC 9728 `WWW-Authenticate` challenge
 * under `_meta["mcp/www_authenticate"]`. This tool-result challenge — NOT a
 * transport-level HTTP 401 — is what triggers an MCP host's (e.g. ChatGPT's)
 * OAuth sign-in UI, so it must be returned on the CallToolResult itself.
 * `resourceMetadataUrl` points at this server's protected-resource metadata so
 * the client can discover the authorization server, and `scopes` advertises what
 * to request.
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
