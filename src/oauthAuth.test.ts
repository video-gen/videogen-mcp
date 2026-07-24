import assert from "node:assert/strict";
import { test } from "node:test";
import { type McpOAuthContext, createMcpOperations } from "./operations";
import { getErrorStatusCode } from "./result";

const OAUTH_CONTEXT: McpOAuthContext = {
  resourceMetadataUrl: "https://mcp.videogen.io/.well-known/oauth-protected-resource",
  scopes: ["email", "profile"],
};

/** A minimal stand-in for an SDK HTTP error carrying an HTTP status code. */
function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function getWwwAuthenticate(meta: Record<string, unknown> | undefined): string[] | undefined {
  const value = meta?.["mcp/www_authenticate"];

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

void test("getErrorStatusCode extracts the HTTP status from an SDK error", () => {
  assert.equal(getErrorStatusCode(httpError(401, "Unauthorized")), 401);
  assert.equal(getErrorStatusCode(httpError(500, "Server error")), 500);
});

void test("getErrorStatusCode returns null for non-HTTP errors", () => {
  assert.equal(getErrorStatusCode(new Error("boom")), null);
  assert.equal(getErrorStatusCode("plain string"), null);
  assert.equal(getErrorStatusCode({ message: "no status" }), null);
});

void test("OAuth-enabled server returns a WWW-Authenticate challenge on 401", () => {
  const { toErrorResult } = createMcpOperations(OAUTH_CONTEXT);

  const result = toErrorResult(httpError(401, "Unauthorized"));

  assert.equal(result.isError, true);

  const challenges = getWwwAuthenticate(result._meta);
  assert.ok(challenges != null && challenges.length === 1, "expected exactly one challenge");

  const challenge = challenges[0];
  assert.ok(challenge != null);
  assert.match(challenge, /^Bearer /);
  assert.ok(challenge.includes(`resource_metadata="${OAUTH_CONTEXT.resourceMetadataUrl}"`));
  assert.ok(challenge.includes('error="invalid_token"'));
  assert.ok(challenge.includes("error_description="));
});

void test("OAuth-enabled server does NOT challenge on non-401 errors", () => {
  const { toErrorResult } = createMcpOperations(OAUTH_CONTEXT);

  const result = toErrorResult(httpError(500, "Server error"));

  assert.equal(result.isError, true);
  assert.equal(getWwwAuthenticate(result._meta), undefined);
});

void test("API-key-only server (no OAuth context) never challenges, even on 401", () => {
  const { toErrorResult } = createMcpOperations(null);

  const result = toErrorResult(httpError(401, "Unauthorized"));

  assert.equal(result.isError, true);
  assert.equal(getWwwAuthenticate(result._meta), undefined);
});

void test("respondSdk surfaces a 401 as a re-auth challenge on OAuth servers", async () => {
  const { respondSdk } = createMcpOperations(OAUTH_CONTEXT);

  const result = await respondSdk(() => Promise.reject(httpError(401, "Unauthorized")));

  assert.equal(result.isError, true);
  assert.ok(getWwwAuthenticate(result._meta) != null);
});

void test("respondSdk returns a JSON result on success without any challenge", async () => {
  const { respondSdk } = createMcpOperations(OAUTH_CONTEXT);

  const result = await respondSdk(() => Promise.resolve({ ok: true }));

  assert.notEqual(result.isError, true);
  assert.equal(getWwwAuthenticate(result._meta), undefined);
  assert.equal(result.content[0]?.type, "text");
});

void test("the 401 challenge advertises the OAuth scopes", () => {
  const { toErrorResult } = createMcpOperations(OAUTH_CONTEXT);

  const challenge = getWwwAuthenticate(toErrorResult(httpError(401, "Unauthorized"))?._meta)?.[0];

  assert.ok(challenge != null);
  assert.ok(challenge.includes('scope="email profile"'));
});

void test("a credential-less tool call short-circuits to a sign-in challenge without hitting upstream", async () => {
  const { respondSdk } = createMcpOperations(OAUTH_CONTEXT, null, false);

  let upstreamCalled = false;
  const result = await respondSdk(() => {
    upstreamCalled = true;

    return Promise.resolve({ ok: true });
  });

  assert.equal(upstreamCalled, false, "must not call upstream when no credentials were presented");
  assert.equal(result.isError, true);

  const challenge = getWwwAuthenticate(result._meta)?.[0];
  assert.ok(challenge != null);
  assert.ok(challenge.includes(`resource_metadata="${OAUTH_CONTEXT.resourceMetadataUrl}"`));
  assert.ok(challenge.includes('scope="email profile"'));
  // OpenAI's Apps SDK only launches its sign-in flow when the challenge carries
  // both `error` and `error_description`, so we emit them even for a
  // purely-missing credential.
  assert.ok(challenge.includes('error="invalid_token"'));
  assert.ok(challenge.includes("error_description="));
});

void test("runComposite also short-circuits to a sign-in challenge when no credentials", async () => {
  const { runComposite } = createMcpOperations(OAUTH_CONTEXT, null, false);

  let startCalled = false;
  const result = await runComposite({
    start: () => {
      startCalled = true;

      return Promise.resolve({ workflowRunId: "wf_123" });
    },
    poll: () => Promise.resolve({ status: "succeeded" }),
    idKey: "workflowRunId",
    controls: {},
  });

  assert.equal(startCalled, false);
  assert.equal(result.isError, true);
  assert.ok(getWwwAuthenticate(result._meta) != null);
});

void test("no credentials on an API-key-only server proceeds (no OAuth flow to run)", async () => {
  const { respondSdk } = createMcpOperations(null, null, false);

  const result = await respondSdk(() => Promise.resolve({ ok: true }));

  assert.notEqual(result.isError, true);
  assert.equal(getWwwAuthenticate(result._meta), undefined);
});

void test("awaitReady polls until the resource is ready, then returns the snapshot", async () => {
  const { awaitReady } = createMcpOperations(null);

  let calls = 0;
  const result = await awaitReady({
    poll: () => {
      calls += 1;

      return Promise.resolve({ attempt: calls });
    },
    isReady: () => calls >= 2,
    controls: { pollIntervalMs: 1 },
  });

  assert.equal(calls, 2);
  assert.notEqual(result.isError, true);
  assert.equal(result.content[0]?.type, "text");
});

void test("awaitReady returns an error result when the resource never becomes ready before the timeout", async () => {
  const { awaitReady } = createMcpOperations(null);

  let calls = 0;
  const result = await awaitReady({
    poll: () => {
      calls += 1;

      return Promise.resolve({ status: "processing" });
    },
    // Never ready: the loop must exit on the (immediate) timeout, not because
    // isReady flipped, and it must NOT report success for a still-processing file.
    isReady: () => false,
    controls: { pollIntervalMs: 1, timeoutMs: 1 },
  });

  assert.equal(result.isError, true, "a still-processing file must not be reported as ready");
  assert.ok(calls >= 1, "must poll at least once");
});

void test("awaitReady short-circuits to a sign-in challenge without polling when no credentials", async () => {
  const { awaitReady } = createMcpOperations(OAUTH_CONTEXT, null, false);

  let polled = false;
  const result = await awaitReady({
    poll: () => {
      polled = true;

      return Promise.resolve({ ready: true });
    },
    isReady: () => true,
    controls: {},
  });

  assert.equal(polled, false, "must not poll when no credentials were presented");
  assert.equal(result.isError, true);
  assert.ok(getWwwAuthenticate(result._meta) != null);
});
