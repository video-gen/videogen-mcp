import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { z } from "zod";
import { getMediaPreviewWidgetHtml, getUploadWidgetHtml } from "./appWidget";

const initializationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.literal("ui/initialize"),
  params: z.object({
    appInfo: z.object({ name: z.string(), version: z.string() }),
    appCapabilities: z.object({}),
    protocolVersion: z.literal("2026-01-26"),
  }),
});

for (const widget of [
  { name: "videogen-upload", html: getUploadWidgetHtml },
  { name: "videogen-media-preview", html: getMediaPreviewWidgetHtml },
]) {
  void test(`${widget.name} bundle completes initialization only with its actual host`, () => {
    const messages: unknown[] = [];
    const parent = {
      postMessage(message: unknown, targetOrigin: string): void {
        assert.equal(targetOrigin, "*");
        messages.push(structuredClone(message));
      },
    };
    const surface = new EventTarget();
    Object.defineProperty(surface, "parent", { value: parent });
    const destinations: unknown[] = [];
    let rootReads = 0;

    const html = widget.html();
    const scriptStart = html.indexOf("<script>");
    const scriptEnd = html.lastIndexOf("</script>");
    assert.ok(scriptStart >= 0 && scriptEnd > scriptStart);
    const script = html.slice(scriptStart + "<script>".length, scriptEnd);
    // Execute the shipped entry point without mounting React. The host handshake
    // must start immediately, independently of file selection or media fetching.
    runInNewContext(script, {
      window: surface,
      document: {
        getElementById: () =>
          ++rootReads === 1
            ? null
            : { dataset: { appUrl: "https://prerelease.app.videogen.io" } },
      },
      console,
      setTimeout,
      clearTimeout,
    });

    assert.equal(messages.length, 1);
    const request = initializationSchema.parse(messages[0]);
    assert.equal(request.params.appInfo.name, widget.name);

    const dispatch = (source: unknown, data: unknown): void => {
      const event = new Event("message");
      Object.defineProperties(event, {
        source: { value: source },
        data: { value: data },
      });
      surface.dispatchEvent(event);
    };
    const response = {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2026-01-26",
        hostInfo: { name: "qa-host", version: "1" },
        hostCapabilities: {},
      },
    };

    dispatch({}, response);
    dispatch(parent, { ...response, id: "another-widget" });
    dispatch(parent, { ...response, jsonrpc: "1.0" });
    dispatch(parent, {
      ...response,
      error: { code: -32603, message: "Initialization failed" },
    });
    dispatch(parent, { ...response, result: null });
    assert.equal(
      messages.length,
      1,
      "Untrusted or unsuccessful replies must not mark the UI ready",
    );

    dispatch(parent, response);
    assert.deepEqual(messages[1], {
      jsonrpc: "2.0",
      method: "ui/notifications/initialized",
      params: {},
    });
    dispatch(parent, response);
    assert.equal(
      messages.length,
      2,
      "Readiness must be acknowledged only once",
    );
    Object.defineProperty(surface, "openai", {
      value: {
        setOpenInAppUrl: (destination: unknown) =>
          destinations.push(structuredClone(destination)),
      },
    });
    surface.dispatchEvent(new Event("openai:set_globals"));
    assert.deepEqual(destinations, [
      { href: "https://prerelease.app.videogen.io" },
    ]);
  });
}
