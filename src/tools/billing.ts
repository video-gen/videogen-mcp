import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetVideoGenClient } from "../client";
import type { McpHostSurface } from "../hostSurface";
import type { McpOperations } from "../operations";
import { billingAccountOutputSchema, billingOrderOutputSchema } from "../outputSchemas";
import { errorResult } from "../result";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../toolAnnotations";

/** Native VideoGen metadata contract, not a claim of a standardized wallet protocol. */
export const BILLING_PAYMENT_META_KEY = "com.videogen/payment";
export const BILLING_TOOL_NAMES: readonly string[] = ["get_billing_account", "create_billing_order", "get_billing_order",
  "complete_billing_order", "cancel_billing_order", "request_billing_refund"];
const orderInput = { orderId: z.string().uuid() };
const writeAnnotations = { readOnlyHint: false, idempotentHint: true, openWorldHint: false, destructiveHint: true };
const scopedCredential = z.object({ paymentToken: z.string().startsWith("spt_").max(300) }).strict();

export function registerBillingTools(server: McpServer, getClient: GetVideoGenClient,
  { respondSdk }: McpOperations, hostSurface: McpHostSurface): void {
  // Unknown/direct calls also fail because these names are never registered on
  // CHATGPT_APP. Core independently rejects that integration's verified OAuth id.
  if (hostSurface === "CHATGPT_APP") return;
  server.registerTool("get_billing_account", {
    title: "Get billing account", description: "Read the selected team's usable credit balance and billing eligibility. API keys inherit their owner's team billing permissions. OAuth integrations require explicit billing consent; account linking alone does not grant it. This read never submits a payment.",
    inputSchema: {}, outputSchema: billingAccountOutputSchema, annotations: READ_ONLY_TOOL_ANNOTATIONS,
  }, async () => await respondSdk(() => getClient().billing.getBillingAccount()));
  server.registerTool("create_billing_order", {
    title: "Quote credit purchase", description: "Prepare a one-time credit quote for an eligible active USD subscriber, without paying or generating. Use a fresh UUID for a new quote and reuse it for quote retries. Show seller, beneficiary team, credits, total, currency, taxes, fees, expiry and refund terms before asking approval. API keys inherit their owner's team billing permissions; OAuth integrations require explicit billing consent in VideoGen.",
    inputSchema: { ...orderInput, credits: z.number().int().min(2_000).max(1_000_000).multipleOf(100) }, outputSchema: billingOrderOutputSchema, annotations: writeAnnotations,
  }, async (args) => await respondSdk(() => getClient().billing.createBillingOrder(args)));
  server.registerTool("get_billing_order", {
    title: "Get billing order", description: "Read the original order's current payment and credit fulfillment status. Check this before retrying an uncertain purchase. Paid pending fulfillment means payment settled but credits are not yet confirmed. This read never collects money or grants credits.",
    inputSchema: orderInput, outputSchema: billingOrderOutputSchema, annotations: READ_ONLY_TOOL_ANNOTATIONS,
  }, async (args) => await respondSdk(() => getClient().billing.getBillingOrder(args)));
  server.registerTool("complete_billing_order", {
    title: "Complete approved credit purchase", description: "Sensitive write: pay only this exact quoted order after explicit approval of its complete terms. Requires a compatible wallet supplying a scoped credential through secure request metadata. Never ask the user to paste payment credentials or put them in arguments. Reuse the original order, revision and idempotency key after an uncertain outcome. A paid result is separate from fulfilled credits. No recurring subscriptions.",
    inputSchema: { ...orderInput, revision: z.number().int().nonnegative(), idempotencyKey: z.string().min(16).max(200) },
    outputSchema: billingOrderOutputSchema, annotations: writeAnnotations, _meta: { "com.videogen/sensitive": true },
  }, async (args, extra) => {
    const credential = scopedCredential.safeParse(extra._meta?.[BILLING_PAYMENT_META_KEY]);
    if (!credential.success) return errorResult("A compatible wallet must securely supply this order's payment credential. Do not ask the user to paste one. No payment was submitted by this call.");
    return await respondSdk(() => getClient().billing.completeBillingOrder(args, { paymentToken: credential.data.paymentToken, signal: extra.signal }));
  });
  server.registerTool("cancel_billing_order", {
    title: "Cancel unpaid credit purchase", description: "Cancel this unpaid order. If payment already settled, return its paid outcome; this does not refund a settled payment. Check status after a cancellation or payment race.",
    inputSchema: orderInput, outputSchema: billingOrderOutputSchema, annotations: writeAnnotations,
  }, async (args) => await respondSdk(() => getClient().billing.cancelBillingOrder(args)));
  server.registerTool("request_billing_refund", {
    title: "Request credit purchase refund", description: "Sensitive write: submit a support-reviewed refund request for this paid order. Obtain approval for the request. Requested does not mean approved, refunded or credits reversed. This operation never automatically issues a refund.",
    inputSchema: { ...orderInput, reason: z.string().trim().min(1).max(1000) }, outputSchema: billingOrderOutputSchema, annotations: writeAnnotations,
    _meta: { "com.videogen/sensitive": true },
  }, async (args) => await respondSdk(() => getClient().billing.requestBillingRefund(args)));
}
