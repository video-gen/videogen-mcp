import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MCP_CHATGPT_PATH,
  MCP_PATH,
  OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH,
  OAUTH_PROTECTED_RESOURCE_MCP_PATH,
  buildProtectedResourceMetadata,
  buildResourceMetadataUrl,
  buildWwwAuthenticateChallenge,
} from "./oauthProtectedResource";

void test("buildProtectedResourceMetadata returns null when no OAuth issuer is configured", () => {
  assert.equal(
    buildProtectedResourceMetadata({
      origin: "https://dev.mcp.videogen.io",
      oauthIssuer: null,
    }),
    null,
  );
});

void test("buildProtectedResourceMetadata returns the RFC 9728 document when an issuer is set", () => {
  const metadata = buildProtectedResourceMetadata({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
  });

  assert.ok(metadata != null);
  assert.equal(metadata.resource, `https://dev.mcp.videogen.io${MCP_PATH}`);
  assert.deepEqual(metadata.authorization_servers, ["https://example.supabase.co/auth/v1"]);
  assert.deepEqual(metadata.scopes_supported, ["email", "profile"]);
  assert.deepEqual(metadata.bearer_methods_supported, ["header"]);
  assert.equal(typeof metadata.resource_documentation, "string");
});

void test("buildProtectedResourceMetadata accepts the ChatGPT resource path", () => {
  const metadata = buildProtectedResourceMetadata({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
    resourcePath: MCP_CHATGPT_PATH,
  });

  assert.ok(metadata != null);
  assert.equal(metadata.resource, `https://dev.mcp.videogen.io${MCP_CHATGPT_PATH}`);
});

void test("buildResourceMetadataUrl uses RFC 9728 path-aware discovery", () => {
  assert.equal(
    buildResourceMetadataUrl({
      origin: "https://dev.mcp.videogen.io",
      resourcePath: MCP_PATH,
    }),
    `https://dev.mcp.videogen.io${OAUTH_PROTECTED_RESOURCE_MCP_PATH}`,
  );
  assert.equal(
    buildResourceMetadataUrl({
      origin: "https://dev.mcp.videogen.io",
      resourcePath: MCP_CHATGPT_PATH,
    }),
    `https://dev.mcp.videogen.io${OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH}`,
  );
});

void test("buildWwwAuthenticateChallenge falls back to a plain Bearer realm without an issuer", () => {
  assert.equal(
    buildWwwAuthenticateChallenge({
      origin: "https://dev.mcp.videogen.io",
      oauthIssuer: null,
    }),
    'Bearer realm="VideoGen MCP"',
  );
});

void test("buildWwwAuthenticateChallenge includes path-aware resource_metadata when an issuer is set", () => {
  const challenge = buildWwwAuthenticateChallenge({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
  });

  assert.match(challenge, /^Bearer /);
  assert.ok(
    challenge.includes(
      `resource_metadata="https://dev.mcp.videogen.io${OAUTH_PROTECTED_RESOURCE_MCP_PATH}"`,
    ),
  );
});

void test("buildWwwAuthenticateChallenge can include invalid_token for lazy-auth gates", () => {
  const challenge = buildWwwAuthenticateChallenge({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
    includeInvalidToken: true,
  });

  assert.ok(challenge.includes('error="invalid_token"'));
  assert.ok(challenge.includes("error_description="));
  assert.ok(challenge.includes('scope="email profile"'));
});
