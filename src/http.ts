import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { VideoGen } from "@videogen/sdk";
import { applyServerProxyKeepAliveTimeouts } from "./applyServerProxyKeepAliveTimeouts";
import { OAUTH_SCOPES, SERVER_NAME, SERVER_VERSION, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import {
  getVideogenEnvironment,
  readHttpServerConfig,
  type VideogenEnvironment,
} from "./env";
import type { McpOAuthContext } from "./operations";
import { mirrorSecuritySchemesToTopLevel } from "./securitySchemes";

const MCP_PATH = "/mcp";
const OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

// RFC 9728 §3.1 path-aware discovery: because our resource identifier ends in
// `/mcp`, a spec-compliant client derives the metadata URL by inserting the
// resource path AFTER the well-known segment. We serve this alongside the root
// well-known URL so both discovery styles resolve to the same metadata.
const OAUTH_PROTECTED_RESOURCE_MCP_PATH = `${OAUTH_PROTECTED_RESOURCE_PATH}${MCP_PATH}`;

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

/**
 * Builds the OAuth 2.0 Protected Resource Metadata (RFC 9728) that MCP clients
 * fetch to discover which authorization server issues tokens for this resource.
 * Returns null when no OAuth issuer is configured (API-key-only mode).
 */
function buildProtectedResourceMetadata(req: IncomingMessage): Record<string, unknown> | null {
  if (config.oauthIssuer == null) {
    return null;
  }

  const origin = getRequestOrigin(req);

  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [config.oauthIssuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://docs.videogen.io/libraries/mcp",
  };
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

/**
 * Builds the `WWW-Authenticate` challenge for an unauthenticated request. When
 * an OAuth issuer is configured, it points clients at this resource's protected
 * resource metadata (per the MCP authorization spec) so they can bootstrap the
 * OAuth flow; otherwise it falls back to a plain Bearer realm.
 */
function buildWwwAuthenticateChallenge(req: IncomingMessage): string {
  if (config.oauthIssuer == null) {
    return 'Bearer realm="VideoGen MCP"';
  }

  const resourceMetadataUrl = `${getRequestOrigin(req)}${OAUTH_PROTECTED_RESOURCE_PATH}`;

  return `Bearer realm="VideoGen MCP", resource_metadata="${resourceMetadataUrl}"`;
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  // In OAuth mode (an issuer is configured) we DON'T reject unauthenticated
  // requests at the transport. Discovery (`initialize` / `tools/list`) must be
  // served without a token so a host like ChatGPT can enumerate and render the
  // tools, and a tool INVOCATION without credentials must reach the handler so it
  // can return the RFC 9728 challenge on the tool RESULT
  // (`_meta["mcp/www_authenticate"]`) — the piece ChatGPT keys off to launch its
  // sign-in flow (see `createMcpOperations`). A transport-level HTTP 401 short of
  // that leaves ChatGPT seeing no tools and never prompting for login.
  //
  // In API-key-only mode (no issuer) there is no OAuth flow to run, so we keep
  // the transport-level `WWW-Authenticate` challenge for a missing token.
  if (token == null && config.oauthIssuer == null) {
    res.setHeader("WWW-Authenticate", buildWwwAuthenticateChallenge(req));
    writeJsonRpcError(
      res,
      401,
      -32001,
      "Missing VideoGen credentials. Send an API key (create one at https://app.videogen.io/developers) or an OAuth access token as an 'Authorization: Bearer <token>' header.",
    );

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
  // protected-resource metadata for the origin the client actually reached us on.
  const oauthContext: McpOAuthContext | null =
    config.oauthIssuer != null
      ? {
          resourceMetadataUrl: `${getRequestOrigin(req)}${OAUTH_PROTECTED_RESOURCE_PATH}`,
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
  // `mirrorSecuritySchemesToTopLevel`.
  const originalSend = transport.send.bind(transport);
  transport.send = (message, options) =>
    originalSend(mirrorSecuritySchemesToTopLevel(message), options);

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
      docs: "https://docs.videogen.io",
    });

    return;
  }

  if (
    (pathname === OAUTH_PROTECTED_RESOURCE_PATH ||
      pathname === OAUTH_PROTECTED_RESOURCE_MCP_PATH) &&
    method === "GET"
  ) {
    const metadata = buildProtectedResourceMetadata(req);

    if (metadata == null) {
      writeJsonRpcError(res, 404, -32601, "Not found.");

      return;
    }

    writeJson(res, 200, metadata);

    return;
  }

  if (pathname === MCP_PATH) {
    if (method === "POST") {
      handleMcpPost(req, res).catch((err: unknown) => {
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
    `[videogen-mcp] Remote MCP server listening on port ${config.port} (endpoint ${MCP_PATH}).\n`,
  );
});
