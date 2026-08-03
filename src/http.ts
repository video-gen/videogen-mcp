import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isJSONRPCResponse } from "@modelcontextprotocol/sdk/types.js";
import type { VideoGen } from "@videogen/sdk";
import { applyServerProxyKeepAliveTimeouts } from "./applyServerProxyKeepAliveTimeouts";
import { OAUTH_SCOPES, SERVER_NAME, SERVER_VERSION, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import {
  getVideogenEnvironment,
  readHttpServerConfig,
  type VideogenEnvironment,
} from "./env";
import {
  getHasToolAuthChallenge,
  getMcpMethodFromBody,
  getToolNamesFromListResult,
  logMcpRequest,
} from "./mcpRequestLog";
import type { McpOAuthContext } from "./operations";
import {
  MCP_CHATGPT_PATH,
  MCP_PATH,
  OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH,
  OAUTH_PROTECTED_RESOURCE_MCP_PATH,
  OAUTH_PROTECTED_RESOURCE_PATH,
  type McpAuthChallengeMode,
  buildProtectedResourceMetadata,
  buildResourceMetadataUrl,
  buildWwwAuthenticateChallenge,
} from "./oauthProtectedResource";
import { getCallsProtectedTool } from "./protectedToolAuth";
import { mirrorSecuritySchemesToTopLevel } from "./securitySchemes";

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const BODY_READ_TIMEOUT_MS = 30 * 1000;

const config = readHttpServerConfig();

/**
 * Logs a server-side error to stderr (this package's logging channel). Only a
 * static context string plus the error's own message are logged — never the
 * request headers, bearer token, or body — so caller credentials never land in
 * logs.
 */
function logServerError(context: string, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);

  process.stderr.write(`[videogen-mcp] ${context} ${detail}\n`);
}

/**
 * Applies permissive CORS so browser-based MCP clients can reach the server.
 * Auth travels in the `Authorization` header (never a cookie), so a wildcard
 * origin is safe here — there are no ambient credentials to leak.
 */
function applyCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

/** Writes a JSON-RPC 2.0 error envelope, which MCP clients understand. */
function writeJsonRpcError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  writeJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null });
}

/**
 * Resolves the public origin of this server used to build OAuth metadata and
 * `WWW-Authenticate` resource URLs.
 *
 * Trust boundary: the `Host` / `X-Forwarded-Host` / `X-Forwarded-Proto` headers
 * are fully client-controlled, so trusting them lets an attacker point clients'
 * OAuth protected-resource metadata at an origin they control (metadata
 * poisoning). When a public origin is configured (`VIDEOGEN_MCP_PUBLIC_ORIGIN`)
 * we trust ONLY that value and ignore the request headers entirely. We fall
 * back to reconstructing the origin from the (proxy-set) forwarded headers only
 * for local development, where no proxy or attacker sits in front of us.
 */
function getRequestOrigin(req: IncomingMessage): string {
  if (config.publicOrigin != null) {
    return config.publicOrigin;
  }

  const forwardedHost = firstHeaderValue(req.headers["x-forwarded-host"]);
  const host = forwardedHost ?? req.headers.host ?? `localhost:${config.port}`;
  const forwardedProto = firstHeaderValue(req.headers["x-forwarded-proto"]);
  const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (value == null) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;

  return raw != null && raw.trim() !== "" ? raw.split(",")[0]?.trim() ?? null : null;
}

function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;

  if (header == null) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();

  return token != null && token !== "" ? token : null;
}

type ReadBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; reason: "invalid" | "too_large" | "timeout" };

function readJsonBody(req: IncomingMessage): Promise<ReadBodyResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const settle = (result: ReadBodyResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    // Slowloris guard: cap the wall-clock time spent reading the body. The
    // size cap alone doesn't stop a client that opens a connection and dribbles
    // (or never sends) bytes, which would otherwise pin the socket open.
    const timeout = setTimeout(() => {
      req.destroy();
      settle({ ok: false, reason: "timeout" });
    }, BODY_READ_TIMEOUT_MS);

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        req.destroy();
        settle({ ok: false, reason: "too_large" });

        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");

      if (raw.trim() === "") {
        settle({ ok: true, body: undefined });

        return;
      }

      try {
        settle({ ok: true, body: JSON.parse(raw) });
      } catch {
        settle({ ok: false, reason: "invalid" });
      }
    });

    req.on("error", () => {
      settle({ ok: false, reason: "invalid" });
    });
  });
}

async function handleMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  {
    mcpPath,
    authChallengeMode,
  }: {
    mcpPath: string;
    authChallengeMode: McpAuthChallengeMode;
  },
): Promise<void> {
  const bodyResult = await readJsonBody(req);

  if (!bodyResult.ok) {
    if (bodyResult.reason === "timeout") {
      writeJsonRpcError(res, 408, -32001, "Timed out while reading the request body.");
    } else {
      writeJsonRpcError(res, 400, -32700, "Request body must be valid JSON within the size limit.");
    }

    return;
  }

  const token = extractBearerToken(req);
  const mcpMethod = getMcpMethodFromBody(bodyResult.body);
  const hasAuthorization = token != null;
  const origin = getRequestOrigin(req);

  // In API-key-only mode (no issuer) there is no OAuth flow to run, so every
  // credential-less request gets a transport-level `WWW-Authenticate` challenge.
  if (token == null && config.oauthIssuer == null) {
    res.setHeader(
      "WWW-Authenticate",
      buildWwwAuthenticateChallenge({
        origin,
        oauthIssuer: config.oauthIssuer,
        resourcePath: mcpPath,
      }),
    );
    writeJsonRpcError(
      res,
      401,
      -32001,
      "Missing VideoGen credentials. Send an API key (create one at https://app.videogen.io/api) or an OAuth access token as an 'Authorization: Bearer <token>' header.",
    );
    logMcpRequest({
      method: mcpMethod,
      httpStatus: 401,
      hasAuthorization,
      authChallengeEmitted: true,
    });

    return;
  }

  // Default `/mcp` (HTTP_401): lazy auth for Cursor / Claude. Discovery
  // (`initialize` / `tools/list`) and `noauth` tools stay anonymous; a protected
  // `tools/call` without a bearer fails at the transport with `401` +
  // `WWW-Authenticate` BEFORE the MCP layer. A soft `200` tool-result challenge
  // is NOT enough for those hosts — they treat it as a normal tool error and
  // never attach the OAuth token.
  //
  // `/mcp/chatgpt` (TOOL_RESULT): ChatGPT Apps do not re-trigger OAuth from a
  // transport `401` on `tools/call`. They need the tool-result
  // `_meta["mcp/www_authenticate"]` challenge from `createMcpOperations`, so
  // credential-less protected calls must reach the handler.
  if (
    token == null &&
    config.oauthIssuer != null &&
    authChallengeMode === "HTTP_401" &&
    getCallsProtectedTool(bodyResult.body)
  ) {
    res.setHeader(
      "WWW-Authenticate",
      buildWwwAuthenticateChallenge({
        origin,
        oauthIssuer: config.oauthIssuer,
        resourcePath: mcpPath,
        includeInvalidToken: true,
      }),
    );
    writeJson(res, 401, {
      error: "invalid_token",
      error_description: "Sign in to VideoGen to continue",
    });
    logMcpRequest({
      method: mcpMethod,
      httpStatus: 401,
      hasAuthorization,
      authChallengeEmitted: true,
    });

    return;
  }

  // The SDK client is built lazily — only when a tool actually performs an API
  // call. Discovery (`initialize` / `tools/list`) never runs a tool handler, so
  // an anonymous caller (no token) never triggers construction and the SDK
  // constructor's mandatory-key check never fires; that is what lets the
  // OAuth-enabled server serve `tools/list` without a credential. A
  // credential-less tool INVOCATION is short-circuited by `createMcpOperations`
  // (the OAuth sign-in challenge) before `getClient` is reached, so the client is
  // only ever constructed once a request is genuinely about to hit the API.
  // Memoized so a multi-step tool call (start + polls) reuses one client.
  let requestClient: VideoGen | null = null;
  const getClient = (): VideoGen => {
    // `token` is the caller's raw bearer credential — an OAuth access token for
    // OAuth-linked hosts, or an API key otherwise; the upstream API accepts both.
    requestClient ??= createVideoGenClientFromToken({
      bearerToken: token ?? "",
      baseUrl: config.baseUrl,
    });

    return requestClient;
  };

  // When an issuer is configured the caller may present an OAuth access token, so
  // bind the server to this request's OAuth context: upstream 401s then surface a
  // re-authentication challenge (`_meta["mcp/www_authenticate"]`) pointing at the
  // protected-resource metadata for the origin + MCP path the client reached.
  const oauthContext: McpOAuthContext | null =
    config.oauthIssuer != null
      ? {
          resourceMetadataUrl: buildResourceMetadataUrl({ origin, resourcePath: mcpPath }),
          scopes: OAUTH_SCOPES,
        }
      : null;

  // Aborts in-flight long-poll loops when the client disconnects. Without it,
  // `runComposite` keeps polling the upstream API after the client has hung up,
  // wasting work on a response nobody will read.
  const abortController = new AbortController();

  const server = buildMcpServer(
    getClient,
    "HOSTED",
    oauthContext,
    abortController.signal,
    token != null,
  );

  // Stateless: a fresh server + transport per request, since each request may
  // authenticate as a different team. Omitting `sessionIdGenerator` disables
  // session management (the SDK treats an undefined generator as stateless); we
  // omit it rather than pass an explicit `undefined` because the option is typed
  // `sessionIdGenerator?: () => string` and this package compiles with
  // `exactOptionalPropertyTypes`, which rejects an explicit `undefined`.
  const transport = new StreamableHTTPServerTransport({});

  // Patch outbound messages so the `tools/list` response carries top-level
  // `securitySchemes` (which the SDK's serializer omits). See
  // `mirrorSecuritySchemesToTopLevel`. Also capture tool names for discovery
  // logs without logging result bodies or secrets.
  let listedToolNames: string[] | null = null;
  let toolAuthChallengeEmitted = false;
  const originalSend = transport.send.bind(transport);
  transport.send = (message, options) => {
    const mirrored = mirrorSecuritySchemesToTopLevel(message);

    if (isJSONRPCResponse(mirrored)) {
      const toolNames = getToolNamesFromListResult(mirrored.result);

      if (toolNames != null) {
        listedToolNames = toolNames;
      }

      if (getHasToolAuthChallenge(mirrored.result)) {
        toolAuthChallengeEmitted = true;
      }
    }

    return originalSend(mirrored, options);
  };

  const cleanup = (): void => {
    abortController.abort();
    void transport.close();
    void server.close();
  };

  res.on("close", cleanup);
  req.on("close", cleanup);

  try {
    // We intentionally use an unsafe `as` assertion here because the SDK's
    // StreamableHTTPServerTransport getters (`onclose`/`onerror`/`onmessage`)
    // are typed `X | undefined`, which fails to satisfy its own `Transport`
    // interface (optional `X`) under this package's `exactOptionalPropertyTypes`.
    // The class is the canonical transport for `server.connect`, and no
    // restructuring (typed local, wrapper fn, rebuilt object) can change a
    // getter's declared type.
    await server.connect(transport as Transport);
    await transport.handleRequest(req, res, bodyResult.body);
    logMcpRequest({
      method: mcpMethod,
      httpStatus: res.statusCode,
      hasAuthorization,
      toolNames: listedToolNames,
      authChallengeEmitted: toolAuthChallengeEmitted,
    });
  } catch (err: unknown) {
    logServerError("Failed to handle MCP request.", err);

    if (!res.headersSent) {
      writeJsonRpcError(
        res,
        500,
        -32603,
        "The VideoGen MCP server encountered an unexpected error.",
      );
    }

    logMcpRequest({
      method: mcpMethod,
      httpStatus: res.headersSent ? res.statusCode : 500,
      hasAuthorization,
      toolNames: listedToolNames,
      authChallengeEmitted: toolAuthChallengeEmitted,
    });

    cleanup();
  }
}

/**
 * Health payload in the shape of the VideoGen `ServiceHealthData` contract. The
 * Cloud Run canary validator parses this and only promotes the new revision once
 * `commitInfo.shortSha` matches the commit it just deployed. This is a standalone
 * public package, so we emit the plain shape inline rather than importing the
 * internal `@videogen/defs` type. `SHORT_SHA` / `VIDEOGEN_ENV` are injected into
 * the container at build time (see ci-cd/docker/mcp/Dockerfile).
 */
function buildServiceHealthData(): {
  _v_ServiceHealthData: 1;
  commitInfo: { _v_CommitInfo: 1; shortSha: string; version: null };
  environment: VideogenEnvironment;
} {
  return {
    _v_ServiceHealthData: 1,
    commitInfo: {
      _v_CommitInfo: 1,
      shortSha: process.env.SHORT_SHA ?? "",
      version: null,
    },
    environment: getVideogenEnvironment(),
  };
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  applyCorsHeaders(res);

  const method = req.method ?? "GET";
  const pathname = (req.url ?? "/").split("?")[0];

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();

    return;
  }

  if (pathname === "/health") {
    writeJson(res, 200, buildServiceHealthData());

    return;
  }

  if (pathname === "/" && method === "GET") {
    writeJson(res, 200, {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport: "streamable-http",
      endpoint: MCP_PATH,
      chatgptEndpoint: MCP_CHATGPT_PATH,
      docs: "https://docs.videogen.io",
    });

    return;
  }

  if (
    (pathname === OAUTH_PROTECTED_RESOURCE_PATH ||
      pathname === OAUTH_PROTECTED_RESOURCE_MCP_PATH ||
      pathname === OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH) &&
    method === "GET"
  ) {
    const resourcePath =
      pathname === OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH ? MCP_CHATGPT_PATH : MCP_PATH;
    const metadata = buildProtectedResourceMetadata({
      origin: getRequestOrigin(req),
      oauthIssuer: config.oauthIssuer,
      resourcePath,
    });

    if (metadata == null) {
      writeJsonRpcError(res, 404, -32601, "Not found.");

      return;
    }

    writeJson(res, 200, metadata);

    return;
  }

  if (pathname === MCP_PATH || pathname === MCP_CHATGPT_PATH) {
    const authChallengeMode: McpAuthChallengeMode =
      pathname === MCP_CHATGPT_PATH ? "TOOL_RESULT" : "HTTP_401";

    if (method === "POST") {
      handleMcpPost(req, res, { mcpPath: pathname, authChallengeMode }).catch((err: unknown) => {
        logServerError("Unhandled error in MCP POST handler.", err);

        if (!res.headersSent) {
          writeJsonRpcError(
            res,
            500,
            -32603,
            "The VideoGen MCP server encountered an unexpected error.",
          );
        }
      });

      return;
    }

    // Stateless mode has no server-initiated streams or sessions to manage, so
    // GET (SSE) and DELETE (session teardown) are unsupported.
    res.setHeader("Allow", "POST, OPTIONS");
    writeJsonRpcError(
      res,
      405,
      -32000,
      "Method not allowed. This MCP endpoint accepts POST requests.",
    );

    return;
  }

  writeJsonRpcError(res, 404, -32601, "Not found.");
});

applyServerProxyKeepAliveTimeouts({ server: httpServer });

httpServer.listen(config.port, () => {
  process.stdout.write(
    `[videogen-mcp] Remote MCP server listening on port ${config.port} (endpoint ${MCP_PATH}; ChatGPT ${MCP_CHATGPT_PATH}).\n`,
  );
});
