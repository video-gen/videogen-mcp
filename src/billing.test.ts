import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";
import { BILLING_PAYMENT_META_KEY, BILLING_TOOL_NAMES } from "./tools/billing";

const orderId = "11111111-1111-4111-8111-111111111111";
const paymentToken = "spt_fake_mcp_transport_test";
const completion = { orderId, revision: 0, idempotencyKey: "mcp-billing-idempotency-test" };

void test("billing discovery is standard-only and omitted names reject direct ChatGPT calls", async () => {
  for (const host of ["STANDARD", "CHATGPT_APP"] satisfies Array<"STANDARD" | "CHATGPT_APP">) {
    const server = buildMcpServer(() => assert.fail("Discovery must not access an account"), "HOSTED", null, null, false, host);
    const client = new Client({ name: "billing-discovery-test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
    try {
      const { tools } = await client.listTools();
      for (const name of BILLING_TOOL_NAMES) assert.equal(tools.some((tool) => tool.name === name), host === "STANDARD", name);
      if (host === "CHATGPT_APP") {
        for (const name of BILLING_TOOL_NAMES) {
          const result = await client.callTool({ name, arguments: {} });
          assert.equal(result.isError, true, name);
        }
      } else {
        const tool = tools.find((candidate) => candidate.name === "complete_billing_order");
        assert.ok(tool != null);
        assert.equal(tool.annotations?.readOnlyHint, false);
        assert.equal(tool._meta?.["com.videogen/sensitive"], true);
        assert.ok(!JSON.stringify(tool.inputSchema).includes("paymentToken"));
        assert.ok(!JSON.stringify(tool).includes(paymentToken));
      }
    } finally { await client.close(); await server.close(); }
  }
});

void test("completion requires secure metadata and sends one header-only credential", async (context) => {
  const requests: { url: string; body: string; token: string | null; authorization: string | null }[] = [];
  context.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({ url: String(input), body: typeof init?.body === "string" ? init.body : "", token: headers.get("Stripe-Shared-Payment-Token"), authorization: headers.get("Authorization") });
    return Promise.resolve(new Response(JSON.stringify({ orderId, state: "paid_pending_fulfillment", revision: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }));
  });
  const api = createVideoGenClientFromToken({ bearerToken: "test-generation-bearer", baseUrl: "https://api.invalid" });
  const server = buildMcpServer(() => api, "HOSTED", null, null, true, "STANDARD");
  const client = new Client({ name: "billing-metadata-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  try {
    const missing = await client.callTool({ name: "complete_billing_order", arguments: completion });
    assert.equal(missing.isError, true); assert.equal(requests.length, 0);
    const result = await client.callTool({ name: "complete_billing_order", arguments: completion,
      _meta: { [BILLING_PAYMENT_META_KEY]: { paymentToken } } });
    assert.notEqual(result.isError, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.token, paymentToken);
    assert.equal(requests[0]?.authorization, "Bearer test-generation-bearer");
    assert.equal(requests[0]?.body, JSON.stringify({ revision: 0, idempotencyKey: completion.idempotencyKey }));
    assert.ok(!JSON.stringify(result).includes(paymentToken));
    assert.ok(!requests[0]?.url.includes(paymentToken));
  } finally { await client.close(); await server.close(); }
});

void test("ambiguous completion returns an error without automatic spending retries or credential echo", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", () => {
    calls += 1;
    return Promise.resolve(new Response(JSON.stringify({ message: "Payment outcome is unresolved. Check the original order." }), { status: 503 }));
  });
  const api = createVideoGenClientFromToken({ bearerToken: "test-generation-bearer", baseUrl: "https://api.invalid" });
  const server = buildMcpServer(() => api, "HOSTED", null, null, true, "STANDARD");
  const client = new Client({ name: "billing-uncertainty-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  try {
    const result = await client.callTool({ name: "complete_billing_order", arguments: completion, _meta: { [BILLING_PAYMENT_META_KEY]: { paymentToken } } });
    assert.equal(result.isError, true); assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes(paymentToken));
  } finally { await client.close(); await server.close(); }
});
