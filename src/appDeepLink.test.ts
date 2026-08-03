import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appDeepLinkActionFromToolArgs,
  buildAppDeepLinkUrl,
} from "./appDeepLink";

void test("buildAppDeepLinkUrl builds OPEN_UPGRADE against the LOCAL app origin by default", () => {
  const url = buildAppDeepLinkUrl({ type: "OPEN_UPGRADE" });
  assert.equal(url, "http://localhost:3000?vg_action=OPEN_UPGRADE");
});

void test("buildAppDeepLinkUrl maps NAVIGATE PROJECTS to the projects path", () => {
  const url = buildAppDeepLinkUrl({ type: "NAVIGATE", destination: "PROJECTS" });
  assert.equal(url, "http://localhost:3000/projects");
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
