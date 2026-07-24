import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { readHttpServerConfig } from "./env";

let savedIssuer: string | undefined;
let savedSupabaseProjectUrl: string | undefined;
let savedBaseUrl: string | undefined;
let savedVideogenEnv: string | undefined;

beforeEach(() => {
  savedIssuer = process.env.VIDEOGEN_OAUTH_ISSUER;
  savedSupabaseProjectUrl = process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL;
  savedBaseUrl = process.env.VIDEOGEN_BASE_URL;
  savedVideogenEnv = process.env.VIDEOGEN_ENV;
  delete process.env.VIDEOGEN_OAUTH_ISSUER;
  delete process.env.VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL;
  delete process.env.VIDEOGEN_BASE_URL;
  delete process.env.VIDEOGEN_ENV;
});

afterEach(() => {
  restoreEnv("VIDEOGEN_OAUTH_ISSUER", savedIssuer);
  restoreEnv("VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL", savedSupabaseProjectUrl);
  restoreEnv("VIDEOGEN_BASE_URL", savedBaseUrl);
  restoreEnv("VIDEOGEN_ENV", savedVideogenEnv);
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
