import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  appDeepLinkActionFromToolArgs,
  buildAppDeepLinkUrl,
} from "./appDeepLink";

let savedBaseUrl: string | undefined;
let savedVideogenEnv: string | undefined;

beforeEach(() => {
  savedBaseUrl = process.env.VIDEOGEN_BASE_URL;
  savedVideogenEnv = process.env.VIDEOGEN_ENV;
  delete process.env.VIDEOGEN_BASE_URL;
  delete process.env.VIDEOGEN_ENV;
});

afterEach(() => {
  restoreEnv({ key: "VIDEOGEN_BASE_URL", value: savedBaseUrl });
  restoreEnv({ key: "VIDEOGEN_ENV", value: savedVideogenEnv });
});

const restoreEnv = ({
  key,
  value,
}: {
  key: string;
  value: string | undefined;
}): void => {
  if (value == null) {
    delete process.env[key];

    return;
  }

  process.env[key] = value;
};

void test("buildAppDeepLinkUrl follows the default production API stack when VIDEOGEN_ENV is absent", () => {
  const url = buildAppDeepLinkUrl({ type: "OPEN_UPGRADE" });
  assert.equal(url, "https://app.videogen.io?vg_action=OPEN_UPGRADE");
});

void test("buildAppDeepLinkUrl maps NAVIGATE PROJECTS to the projects path", () => {
  process.env.VIDEOGEN_BASE_URL = "http://localhost:4010";

  const url = buildAppDeepLinkUrl({ type: "NAVIGATE", destination: "PROJECTS" });
  assert.equal(url, "http://localhost:3000/projects");
});

void test("buildAppDeepLinkUrl follows a hosted VIDEOGEN_BASE_URL when VIDEOGEN_ENV is absent", () => {
  process.env.VIDEOGEN_BASE_URL = "https://prerelease.api.videogen.io/";

  const url = buildAppDeepLinkUrl({ type: "NAVIGATE", destination: "PROJECTS" });
  assert.equal(url, "https://prerelease.app.videogen.io/projects");
});

void test("appDeepLinkActionFromToolArgs requires articleSlug for OPEN_HELP_ARTICLE", () => {
  assert.equal(
    appDeepLinkActionFromToolArgs({ action: "OPEN_HELP_ARTICLE" }),
    null,
  );
  assert.deepEqual(appDeepLinkActionFromToolArgs({ action: "OPEN_HELP_ARTICLE", articleSlug: "x" }), {
    type: "OPEN_HELP_ARTICLE",
    articleSlug: "x",
  });
});

void test("getIsMcpCommerceDeepLinkAction covers purchase flows used by STANDARD MCP", async () => {
  const { getIsMcpCommerceDeepLinkAction } = await import("./hostSurface");
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_UPGRADE" }), true);
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_INVITE_TEAMMATES" }), false);
});