import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  getPublicOriginHostname,
  getVideogenEnvironmentForBaseUrl,
  readHttpServerConfig,
} from "./env";

let savedIssuer: string | undefined;
let savedSupabaseProjectUrl: string | undefined;
let savedBaseUrl: string | undefined;
let savedVideogenEnv: string | undefined;
let savedOpenaiAppsChallengeToken: string | undefined;
let savedTrustedProxyHops: string | undefined;

beforeEach(() => {
  savedTrustedProxyHops = process.env.VIDEOGEN_MCP_TRUSTED_PROXY_HOPS;
  delete process.env.VIDEOGEN_MCP_TRUSTED_PROXY_HOPS;
  savedIssuer = process.env.VIDEOGEN_OAUTH_ISSUER;
  savedSupabaseProjectUrl = process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL;
  savedBaseUrl = process.env.VIDEOGEN_BASE_URL;
  savedVideogenEnv = process.env.VIDEOGEN_ENV;
  savedOpenaiAppsChallengeToken = process.env.VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN;
  delete process.env.VIDEOGEN_OAUTH_ISSUER;
  delete process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL;
  delete process.env.VIDEOGEN_BASE_URL;
  delete process.env.VIDEOGEN_ENV;
  delete process.env.VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN;
});

afterEach(() => {
  restoreEnv("VIDEOGEN_OAUTH_ISSUER", savedIssuer);
  restoreEnv("VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL", savedSupabaseProjectUrl);
  restoreEnv("VIDEOGEN_BASE_URL", savedBaseUrl);
  restoreEnv("VIDEOGEN_ENV", savedVideogenEnv);
  restoreEnv("VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN", savedOpenaiAppsChallengeToken);
  restoreEnv("VIDEOGEN_MCP_TRUSTED_PROXY_HOPS", savedTrustedProxyHops);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value == null) {
    delete process.env[key];

    return;
  }

  process.env[key] = value;
}

void test("oauthIssuer is null when neither OAuth env var is set", () => {
  assert.equal(readHttpServerConfig().oauthIssuer, null);
});

void test("oauthIssuer uses the explicit issuer and strips a trailing slash", () => {
  process.env.VIDEOGEN_OAUTH_ISSUER = "https://issuer.example.com/auth/v1/";

  assert.equal(readHttpServerConfig().oauthIssuer, "https://issuer.example.com/auth/v1");
});

void test("oauthIssuer derives from the Supabase project URL as ${url}/auth/v1", () => {
  process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL = "https://abcdefgh.supabase.co";

  assert.equal(readHttpServerConfig().oauthIssuer, "https://abcdefgh.supabase.co/auth/v1");
});

void test("oauthIssuer strips a trailing slash from the Supabase project URL before deriving", () => {
  process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL = "https://abcdefgh.supabase.co/";

  assert.equal(readHttpServerConfig().oauthIssuer, "https://abcdefgh.supabase.co/auth/v1");
});

void test("an explicit issuer takes precedence over the Supabase project URL", () => {
  process.env.VIDEOGEN_OAUTH_ISSUER = "https://issuer.example.com/auth/v1";
  process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL = "https://abcdefgh.supabase.co";

  assert.equal(readHttpServerConfig().oauthIssuer, "https://issuer.example.com/auth/v1");
});

void test("baseUrl resolves per environment so each MCP reaches its own API stack", () => {
  process.env.VIDEOGEN_ENV = "DEV";
  assert.equal(readHttpServerConfig().baseUrl, "https://dev.api.videogen.io");

  process.env.VIDEOGEN_ENV = "PRERELEASE";
  assert.equal(readHttpServerConfig().baseUrl, "https://prerelease.api.videogen.io");

  process.env.VIDEOGEN_ENV = "PROD";
  assert.equal(readHttpServerConfig().baseUrl, "https://api.videogen.io");
});

void test("baseUrl falls back to the public prod API when VIDEOGEN_ENV is unset (LOCAL)", () => {
  assert.equal(readHttpServerConfig().baseUrl, "https://api.videogen.io");
});

void test("an explicit VIDEOGEN_BASE_URL overrides the per-environment default", () => {
  process.env.VIDEOGEN_ENV = "DEV";
  process.env.VIDEOGEN_BASE_URL = "http://localhost:4010";

  assert.equal(readHttpServerConfig().baseUrl, "http://localhost:4010");
});

void test("getVideogenEnvironmentForBaseUrl identifies hosted stacks without VIDEOGEN_ENV", () => {
  assert.equal(
    getVideogenEnvironmentForBaseUrl({
      baseUrl: "https://prerelease.api.videogen.io/",
    }),
    "PRERELEASE",
  );
});

void test("getVideogenEnvironmentForBaseUrl keeps custom URLs on the configured environment", () => {
  process.env.VIDEOGEN_ENV = "DEV";

  assert.equal(
    getVideogenEnvironmentForBaseUrl({
      baseUrl: "https://api.example.com",
    }),
    "DEV",
  );
});

void test("openaiAppsChallengeToken is null when the env var is unset", () => {
  assert.equal(readHttpServerConfig().openaiAppsChallengeToken, null);
});

void test("openaiAppsChallengeToken is null when the env var is empty or whitespace", () => {
  process.env.VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN = "";
  assert.equal(readHttpServerConfig().openaiAppsChallengeToken, null);

  process.env.VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN = "   ";
  assert.equal(readHttpServerConfig().openaiAppsChallengeToken, null);
});

void test("openaiAppsChallengeToken uses the env var and strips surrounding whitespace", () => {
  process.env.VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN = "  challenge-token-value  ";

  assert.equal(readHttpServerConfig().openaiAppsChallengeToken, "challenge-token-value");
});

void test("getPublicOriginHostname reads the deployment host and ignores a non-URL override", () => {
  assert.equal(getPublicOriginHostname("https://dev.mcp.videogen.io"), "dev.mcp.videogen.io");
  assert.equal(getPublicOriginHostname("https://dev.mcp.videogen.io/"), "dev.mcp.videogen.io");
  assert.equal(getPublicOriginHostname(null), null);
  assert.equal(getPublicOriginHostname("not a url"), null);
});

void test("forwarded-for trust is off on LOCAL", () => {
  const { trustedProxyHopCount, trustCloudflareEdgeHop } = readHttpServerConfig();
  assert.equal(trustedProxyHopCount, 0);
  assert.equal(trustCloudflareEdgeHop, false);
});

void test("hosted environments trust the Cloud Run hop and step over a Cloudflare edge", () => {
  for (const environment of ["DEV", "PRERELEASE", "PROD"]) {
    process.env.VIDEOGEN_ENV = environment;
    const { trustedProxyHopCount, trustCloudflareEdgeHop } = readHttpServerConfig();
    assert.equal(trustedProxyHopCount, 1);
    assert.equal(trustCloudflareEdgeHop, true);
  }
});

void test("a valid hop override disables the Cloudflare step and an invalid one is ignored", () => {
  process.env.VIDEOGEN_ENV = "PROD";
  process.env.VIDEOGEN_MCP_TRUSTED_PROXY_HOPS = "2";
  const overridden = readHttpServerConfig();
  assert.equal(overridden.trustedProxyHopCount, 2);
  assert.equal(overridden.trustCloudflareEdgeHop, false);

  process.env.VIDEOGEN_MCP_TRUSTED_PROXY_HOPS = "-1";
  assert.equal(readHttpServerConfig().trustedProxyHopCount, 1);
});
