import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { HOME_WIDGET_URI, WIDGET_MIME_TYPE } from "./appWidget";
import { buildMcpServer, type McpExecutionMode } from "./buildServer";

for (const mode of ["HOSTED", "LOCAL"] satisfies McpExecutionMode[]) {
  void test(`VideoGen home is available only on hosted MCP (${mode})`, async () => {
    const server = buildMcpServer(
      () =>
        assert.fail(
          "Opening home must not call the API or require a credential",
        ),
      mode,
      {
        resourceMetadataUrl:
          "https://mcp.videogen.io/.well-known/oauth-protected-resource",
        scopes: ["email", "profile"],
      },
      null,
      false,
      "CHATGPT_APP",
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "home-test", version: "1" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      const { tools } = await client.listTools();
      const home = tools.find((tool) => tool.name === "open_home");
      const { resources } = await client.listResources();
      const resource = resources.find((item) => item.uri === HOME_WIDGET_URI);
      if (mode === "LOCAL") {
        assert.equal(home, undefined);
        assert.equal(resource, undefined);
        return;
      }
      assert.ok(home != null);
      assert.notEqual(HOME_WIDGET_URI, "ui://widget/videogen-app-v2.html", "The external sign-in protocol requires a fresh widget resource");
      assert.equal(home.annotations?.readOnlyHint, true);
      assert.deepEqual(home._meta?.securitySchemes, [{ type: "noauth" }]);
      assert.deepEqual(home._meta?.ui, { resourceUri: HOME_WIDGET_URI });
      assert.deepEqual(home._meta?.["openai/ui"], { entrypoints: [{ type: "global" }] });
      assert.equal(resource?.mimeType, WIDGET_MIME_TYPE);
      const homeHtml = await client.readResource({ uri: HOME_WIDGET_URI });
      const html = homeHtml.contents[0];
      assert.ok(html != null && "text" in html && typeof html.text === "string");
      const csp = z.object({
        ui: z.object({ csp: z.object({
          connectDomains: z.array(z.string()),
          resourceDomains: z.array(z.string()),
          frameDomains: z.array(z.string()),
        }) }),
        "openai/widgetCSP": z.object({
          connect_domains: z.array(z.string()),
          resource_domains: z.array(z.string()),
          redirect_domains: z.array(z.string()),
          frame_domains: z.array(z.string()),
        }),
      }).parse(html._meta);
      assert.deepEqual(csp.ui.csp.connectDomains, []);
      assert.deepEqual(csp.ui.csp.resourceDomains, []);
      assert.deepEqual(csp["openai/widgetCSP"].connect_domains, []);
      assert.deepEqual(csp["openai/widgetCSP"].resource_domains, []);
      assert.deepEqual(csp["openai/widgetCSP"].redirect_domains, ["https://app.videogen.io"]);
      assert.ok(html.text.includes('id="videogen-home-root"'));
      assert.ok(html.text.includes("/chatgpt/"));
      assert.ok(html.text.includes("videogen:open-google-signin"));
      assert.ok(html.text.includes("ui/open-link"));
      assert.deepEqual(csp.ui.csp.frameDomains, ["https://app.videogen.io"]);
      assert.deepEqual(csp["openai/widgetCSP"].frame_domains, ["https://app.videogen.io"]);
      assert.deepEqual(html._meta?.["openai/ui"], { availableDisplayModes: ["fullscreen"] });
      assert.ok(html.text.includes('data-app-url="https://app.videogen.io"'));
      const result = await client.callTool({
        name: "open_home",
        arguments: {},
      });
      assert.notEqual(result.isError, true);
      assert.ok(
        typeof result.structuredContent === "object" &&
          result.structuredContent != null,
      );
      assert.ok("appUrl" in result.structuredContent);
      assert.equal(typeof result.structuredContent.appUrl, "string");
    } finally {
      await client.close();
      await server.close();
    }
  });
}
