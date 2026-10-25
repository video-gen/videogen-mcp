import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createHomeBridge,
  getSafeHomeLink,
  readHomeProjects,
} from "../web/homeBridge.ts";

function installHost(context, handle) {
  const surface = new EventTarget();
  const messages = [];
  const parent = {
    postMessage(message) {
      messages.push(message);
      if (message.id == null) return;
      queueMicrotask(() => handle(message, reply));
    },
  };
  function reply(id, result, source = parent) {
    const event = new Event("message");
    Object.defineProperties(event, {
      source: { value: source },
      data: { value: { jsonrpc: "2.0", id, result } },
    });
    surface.dispatchEvent(event);
  }
  Object.defineProperty(surface, "parent", { value: parent });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: surface,
    configurable: true,
  });
  context.after(() => {
    if (descriptor == null) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", descriptor);
  });
  return { messages, reply };
}

test("home initializes MCP Apps before reading projects and sends only on submit", async (context) => {
  const { messages } = installHost(context, (message, reply) => {
    if (message.method === "ui/initialize")
      reply(message.id, { protocolVersion: "2026-01-26" });
    else if (message.method === "tools/call")
      reply(message.id, { structuredContent: { projects: [] } });
    else if (message.method === "ui/message") reply(message.id, {});
  });
  const bridge = createHomeBridge();
  context.after(() => bridge.dispose());
  assert.deepEqual(
    readHomeProjects(await bridge.callTool("list_projects", { limit: 8 })),
    [],
  );
  assert.deepEqual(
    messages.map((message) => message.method),
    ["ui/initialize", "ui/notifications/initialized", "tools/call"],
  );
  assert.equal(
    await bridge.sendMessage("Make an explainer about gravity"),
    true,
  );
  assert.deepEqual(messages.at(-1).params, {
    role: "user",
    content: [{ type: "text", text: "Make an explainer about gravity" }],
  });
});

test("home rejects messages from other frames and reports failed sends", async (context) => {
  installHost(context, (message, reply) => {
    reply(message.id, { structuredContent: { projects: [] } }, {});
    if (message.method === "ui/initialize") reply(message.id, {});
    else if (message.method === "ui/message")
      reply(message.id, { isError: true });
  });
  const bridge = createHomeBridge();
  context.after(() => bridge.dispose());
  assert.equal(await bridge.sendMessage("Keep this draft"), false);
});

test("home rejects malformed project data and external navigation", () => {
  const project = {
    projectId: "vg_proj_test",
    title: "My video",
    projectUrl: "https://app.videogen.io/project/test",
  };
  assert.deepEqual(
    readHomeProjects({ structuredContent: { projects: [project, null, {}] } }),
    null,
  );
  assert.equal(
    readHomeProjects({ isError: true, structuredContent: { projects: [] } }),
    null,
  );
  assert.equal(
    readHomeProjects({ content: [{ text: "Sign in to continue" }] }),
    null,
  );
  assert.deepEqual(
    readHomeProjects({
      content: [{ text: JSON.stringify({ projects: [project] }) }],
    }),
    [project],
  );
  assert.equal(
    getSafeHomeLink("/projects", "https://dev.app.videogen.io"),
    "https://dev.app.videogen.io/projects",
  );
  assert.equal(
    getSafeHomeLink("https://attacker.example", "https://app.videogen.io"),
    null,
  );
  assert.equal(
    getSafeHomeLink("javascript:alert(1)", "https://app.videogen.io"),
    null,
  );
});
