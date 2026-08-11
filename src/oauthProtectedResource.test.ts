import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MCP_CHATGPT_PATH,
  MCP_PATH,
  OAUTH_PROTECTED_RESOURCE_CHATGPT_PATH,
  OAUTH_PROTECTED_RESOURCE_MCP_PATH,
  buildAuthorizationServerMetadata,
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

void test("buildProtectedResourceMetadata for /mcp advertises the pathless MCP origin (Cursor)", () => {
  const metadata = buildProtectedResourceMetadata({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
  });

  assert.ok(metadata != null);
  assert.equal(metadata.resource, `https://dev.mcp.videogen.io${MCP_PATH}`);
  // Pathless origin — Cursor strips `/auth/v1` from Supabase issuers and then
  // cannot rediscover AS metadata on the bare project host.
  assert.deepEqual(metadata.authorization_servers, ["https://dev.mcp.videogen.io"]);
  assert.deepEqual(metadata.scopes_supported, ["email", "profile"]);
  assert.deepEqual(metadata.bearer_methods_supported, ["header"]);
  assert.equal(typeof metadata.resource_documentation, "string");
});

void test("buildProtectedResourceMetadata for /mcp/chatgpt keeps the Supabase path issuer", () => {
  const metadata = buildProtectedResourceMetadata({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
    resourcePath: MCP_CHATGPT_PATH,
  });

  assert.ok(metadata != null);
  assert.equal(metadata.resource, `https://dev.mcp.videogen.io${MCP_CHATGPT_PATH}`);
  assert.deepEqual(metadata.authorization_servers, ["https://example.supabase.co/auth/v1"]);
});

void test("buildAuthorizationServerMetadata points authorize/token/register at Supabase", () => {
  const metadata = buildAuthorizationServerMetadata({
    origin: "https://dev.mcp.videogen.io",
    oauthIssuer: "https://example.supabase.co/auth/v1",
  });

  assert.equal(metadata.issuer, "https://dev.mcp.videogen.io");
  assert.equal(
    metadata.authorization_endpoint,
    "https://example.supabase.co/auth/v1/oauth/authorize",
  );
  assert.equal(metadata.token_endpoint, "https://example.supabase.co/auth/v1/oauth/token");
  assert.equal(
    metadata.registration_endpoint,
    "https://example.supabase.co/auth/v1/oauth/clients/register",
  );
  assert.equal(
    metadata.jwks_uri,
    "https://example.supabase.co/auth/v1/.well-known/jwks.json",
  );
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

