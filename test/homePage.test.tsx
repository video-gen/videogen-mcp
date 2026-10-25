import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomePage } from "../web/HomePage";

test("home renders the general VideoGen entry points and actual catalog without a host", () => {
  const html = renderToStaticMarkup(
    createElement(HomePage, { appUrl: "https://dev.app.videogen.io" }),
  );
  for (const text of [
    "What do you want to create?",
    "Recent projects",
    "Learn from examples",
    "Featured workflows",
    "Actors",
    "Products",
    "Brands",
    "Locations",
    "Props",
    "Visual styles",
    "Slides themes",
    "Video templates",
    "Quick AI tools",
    "Script to video",
    "Voiceover to video",
    "Storyboard to video",
    "Slides to video",
    "Video presentation",
    "Explainer video",
    "Video campaign",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('href="https://dev.app.videogen.io/projects"'));
  assert.ok(html.includes('data-testid="videogen-home-start"'));
  assert.ok(html.includes("Loading recent projects"));
  assert.ok(
    html.includes("imagedelivery.net"),
    "uses the actual VideoGen asset thumbnails",
  );
});
