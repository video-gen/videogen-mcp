import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomePage } from "../web/HomePage";

test("home embeds the environment's real frontend with no duplicated product UI", () => {
  const html = renderToStaticMarkup(createElement(HomePage, { appUrl: "https://dev.app.videogen.io" }));
  assert.ok(html.includes('src="https://dev.app.videogen.io/chatgpt/"'));
  assert.ok(html.includes('title="VideoGen"'));
  assert.ok(html.includes('sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"'));
  assert.equal((html.match(/<iframe /g) ?? []).length, 1);
  for (const element of ["<form", "<input", "<textarea", "<nav", "<aside", "<section", "<video", "<img"]) assert.equal(html.includes(element), false);
  assert.equal(html.includes("allow-top-navigation"), false);
  assert.ok(html.includes('style="height:100dvh;width:100%;background:white"'));
  assert.equal(html.includes("padding:"), false);
});
