import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  authErrorResult,
  errorResult,
  getErrorMessage,
  getErrorStatusCode,
  jsonResult,
} from "./result";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled"]);
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const startedResponseSchema = z.object({
  workflowRunId: z.string().optional(),
  toolExecutionId: z.string().optional(),
  exportId: z.string().optional(),
});

const statusResponseSchema = z.object({
  status: z.string().optional(),
  downloadUrl: z.string().nullish(),
});

export type PollControls = {
  wait?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type DefinedProps<T> = { [K in keyof T]: Exclude<T[K], undefined> };

/**
 * STOPSHIP: rip this out once https://github.com/fern-api/fern/pull/16972 merges,
 * ships in a new @videogen/sdk, and we bump to it. That PR makes Fern emit optional
 * request-wrapper fields as `T | undefined`, so runtime-validated args become directly
 * assignable and this helper (plus its `as` cast) is no longer needed.
 *
 * Returns a shallow copy with all `undefined`-valued keys removed. Zod's
 * `.optional()` widens fields to `T | undefined`, but the SDK's request types
 * declare optionals as plain `T?` — which, under `exactOptionalPropertyTypes`,
 * rejects an explicit `undefined`. Dropping the empty keys makes a
 * runtime-validated tool-arguments object assignable to the SDK request type.
 */
export function dropUndefined<T extends Record<string, unknown>>(obj: T): DefinedProps<T> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  // We intentionally use an unsafe `as` assertion here because we have removed
  // exactly the `undefined` values that distinguish `T` from `DefinedProps<T>`,
  // a narrowing TypeScript cannot express through an iterative object build.
  return result as DefinedProps<T>;
}

/** Normalizes optional poll-control inputs (which may be undefined) into a compact PollControls object. */
export function extractControls(args: {
  wait: boolean | undefined;
  pollIntervalMs: number | undefined;
  timeoutMs: number | undefined;
}): PollControls {
  return {
    ...(args.wait != null ? { wait: args.wait } : {}),
    ...(args.pollIntervalMs != null ? { pollIntervalMs: args.pollIntervalMs } : {}),
    ...(args.timeoutMs != null ? { timeoutMs: args.timeoutMs } : {}),
  };
}

function getStartedId(
  data: unknown,
  key: "workflowRunId" | "toolExecutionId" | "exportId",
): string | undefined {
  const result = startedResponseSchema.safeParse(data);
  return result.success ? result.data[key] : undefined;
}

function getIsTerminal(data: unknown): boolean {
  const result = statusResponseSchema.safeParse(data);
  if (!result.success) {
    return false;
  }

  const { status, downloadUrl } = result.data;
  if (status != null && TERMINAL_STATUSES.has(status.toLowerCase())) {
    return true;
  }

  return downloadUrl != null;
}

/**
 * Wrapper (rather than an inline `signal?.aborted === true`) so TypeScript does
 * not narrow the check away inside the poll loop: `aborted` is a live getter
 * that can flip to `true` across an `await`, but a repeated property read looks
 * to the compiler like an impossible comparison after the loop condition.
 */
function isAborted(signal: AbortSignal | null | undefined): boolean {
  return signal?.aborted === true;
}

function delay(ms: number, signal: AbortSignal | null): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve();

      return;
    }

    const timer = setTimeout(resolve, ms);

    // Resolve early on abort so a long poll interval doesn't keep the request
    // alive after the client has disconnected.
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * OAuth context for a server instance that authenticates callers with OAuth 2.1
 * access tokens (the hosted transport when an issuer is configured). Carries the
 * protected-resource metadata URL used to build re-auth challenges and the
 * scopes advertised to clients. `null` for API-key-only servers (stdio, or the
 * hosted server without an issuer), which never emit OAuth challenges.
 */
export type McpOAuthContext = {
  resourceMetadataUrl: string;
  scopes: readonly string[];
};

/**
 * The SDK-call wrappers used by every tool handler. Bound once per server
 * instance to its OAuth context so that upstream `401`s surface as a tool-level
 * OAuth re-authentication challenge (`_meta["mcp/www_authenticate"]`) rather
 * than an opaque error.
 */
export type McpOperations = {
  respondSdk: (call: () => Promise<unknown>) => Promise<CallToolResult>;
  runComposite: (args: {
    start: () => Promise<unknown>;
    poll: (id: string) => Promise<unknown>;
    idKey: "workflowRunId" | "toolExecutionId" | "exportId";
    controls: PollControls;
  }) => Promise<CallToolResult>;
  awaitReady: (args: {
    poll: () => Promise<unknown>;
    isReady: (snapshot: unknown) => boolean;
    controls: PollControls;
  }) => Promise<CallToolResult>;
  toErrorResult: (err: unknown) => CallToolResult;
};

/**
 * `abortSignal`, when provided, stops in-flight poll loops promptly once it
 * fires (the hosted transport aborts it on client disconnect). It is optional
 * so API-key-only servers (stdio) and callers without a request lifecycle can
 * omit it.
 *
 * `hasCredentials` is whether the caller presented a bearer token. On an
 * OAuth-enabled server a tool invocation without credentials short-circuits to
 * the RFC 9728 tool-result challenge BEFORE any upstream call — this is what
 * makes an MCP host (ChatGPT) launch its sign-in flow. It keys off
 * `_meta["mcp/www_authenticate"]` on the tool RESULT, not a transport HTTP 401,
 * which is why the hosted server serves discovery unauthenticated and defers the
 * challenge to here. Defaults to `true` for stdio and other callers that always
 * carry a key.
 */
export function createMcpOperations(
  oauthContext: McpOAuthContext | null,
  abortSignal?: AbortSignal | null,
  hasCredentials: boolean = true,
): McpOperations {
  const toErrorResult = (err: unknown): CallToolResult => {
    const message = getErrorMessage(err);

    // A `401` here means a token reached upstream and was rejected as missing,
    // expired, or revoked. Returning the RFC 9728 challenge is what prompts an
    // MCP host to run the OAuth flow again. Only emitted on OAuth-enabled
    // servers — API-key callers can't re-auth through this path. A tokenless
    // caller is short-circuited earlier by `missingCredentialsChallenge` and
    // never reaches upstream.
    if (oauthContext != null && getErrorStatusCode(err) === 401) {
      return authErrorResult({
        message,
        resourceMetadataUrl: oauthContext.resourceMetadataUrl,
        scopes: oauthContext.scopes,
        error: "invalid_token",
        errorDescription:
          "Your VideoGen access token is missing, expired, or revoked. Reauthorize to continue.",
      });
    }

    return errorResult(message);
  };

  // When the caller presented no credentials on an OAuth-enabled server, return
  // the tool-result challenge up front so the host runs OAuth without a wasted
  // upstream round-trip. OpenAI's Apps SDK only launches its sign-in flow when
  // the `mcp/www_authenticate` challenge carries both `error` and
  // `error_description`, so we emit `invalid_token` here even though no token was
  // presented (RFC 6750 §3.1 would omit `error` for a purely-missing credential,
  // but ChatGPT will not trigger linking without it). `null` means "proceed":
  // either credentials are present, or this is an API-key-only server with no
  // OAuth flow to run.
  const missingCredentialsChallenge = (): CallToolResult | null => {
    if (oauthContext == null || hasCredentials) {
      return null;
    }

    return authErrorResult({
      message: "Sign in to VideoGen to continue.",
      resourceMetadataUrl: oauthContext.resourceMetadataUrl,
      scopes: oauthContext.scopes,
      error: "invalid_token",
      errorDescription: "Sign in to VideoGen to continue",
    });
  };

  const respondSdk = async (call: () => Promise<unknown>): Promise<CallToolResult> => {
    const challenge = missingCredentialsChallenge();
    if (challenge != null) {
      return challenge;
    }

    try {
      return jsonResult(await call());
    } catch (err: unknown) {
      return toErrorResult(err);
    }
  };

  const runComposite = async (args: {
    start: () => Promise<unknown>;
    poll: (id: string) => Promise<unknown>;
    idKey: "workflowRunId" | "toolExecutionId" | "exportId";
    controls: PollControls;
  }): Promise<CallToolResult> => {
    const challenge = missingCredentialsChallenge();
    if (challenge != null) {
      return challenge;
    }

    try {
      const started = await args.start();
      const id = getStartedId(started, args.idKey);

      if (args.controls.wait === false || id == null) {
        return jsonResult(started);
      }

      const intervalMs = args.controls.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      const deadline = Date.now() + (args.controls.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      let snapshot = await args.poll(id);
      while (!getIsTerminal(snapshot) && Date.now() < deadline && !isAborted(abortSignal)) {
        await delay(intervalMs, abortSignal ?? null);

        if (isAborted(abortSignal)) {
          break;
        }

        snapshot = await args.poll(id);
      }

      return jsonResult(snapshot);
    } catch (err: unknown) {
      return toErrorResult(err);
    }
  };

  // Polls an already-identified resource until `isReady` (e.g. a freshly
  // uploaded file whose renditions have finished processing). Unlike
  // `runComposite` there is no `start` step — the caller already has the id —
  // and readiness is caller-defined rather than the run/export terminal-status
  // check. Shares the same abort- and credential-aware polling behavior.
  const awaitReady = async (args: {
    poll: () => Promise<unknown>;
    isReady: (snapshot: unknown) => boolean;
    controls: PollControls;
  }): Promise<CallToolResult> => {
    const challenge = missingCredentialsChallenge();
    if (challenge != null) {
      return challenge;
    }

    try {
      const intervalMs = args.controls.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      const deadline = Date.now() + (args.controls.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      let snapshot = await args.poll();
      while (!args.isReady(snapshot) && Date.now() < deadline && !isAborted(abortSignal)) {
        await delay(intervalMs, abortSignal ?? null);

        if (isAborted(abortSignal)) {
          break;
        }

        snapshot = await args.poll();
      }

      // The loop also exits on timeout or abort with the resource still not
      // ready. Unlike `runComposite` (whose snapshot embeds a terminal
      // status/downloadUrl the model can read), readiness here is caller-defined
      // and invisible in the payload, so a not-ready snapshot is indistinguishable
      // from a ready one. Returning a success `jsonResult` would tell the model
      // the file finished processing when it did not — surface an error result
      // (with the latest snapshot for context) unless readiness was reached.
      if (!args.isReady(snapshot)) {
        return errorResult(
          `The file is still processing and did not become ready in time. Try get_file again in a moment, or increase timeoutMs. Latest state:\n${JSON.stringify(snapshot, null, 2)}`,
        );
      }

      return jsonResult(snapshot);
    } catch (err: unknown) {
      return toErrorResult(err);
    }
  };

  return { respondSdk, runComposite, awaitReady, toErrorResult };
}
