import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHATGPT_APP_ACCOUNT_GATE_MESSAGE,
  CHATGPT_APP_COMMERCE_DEEP_LINK_REJECTED_MESSAGE,
  getIsChatGptForbiddenNavigateDestination,
  getIsMcpCommerceDeepLinkAction,
  getLooksLikeMcpBillingGateMessage,
  rewriteMcpErrorMessageForHostSurface,
} from "./hostSurface";

void test("commerce deep-link actions are detected", () => {
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_UPGRADE" }), true);
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_PURCHASE_CREDITS" }), true);
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_ENABLE_TOP_UPS" }), true);
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_RATE_CARD" }), true);
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "NAVIGATE" }), false);
  assert.equal(getIsMcpCommerceDeepLinkAction({ action: "OPEN_INVITE_TEAMMATES" }), false);
});

void test("ChatGPT forbids NAVIGATE to billing settings", () => {
  assert.equal(getIsChatGptForbiddenNavigateDestination({ destination: "BILLING_SETTINGS" }), true);
  assert.equal(getIsChatGptForbiddenNavigateDestination({ destination: "PROJECTS" }), false);
  assert.equal(getIsChatGptForbiddenNavigateDestination({ destination: "ACCOUNT_SETTINGS" }), false);
  assert.equal(getIsChatGptForbiddenNavigateDestination({ destination: "USAGE" }), false);
});

void test("ChatGPT Apps rewrites billing-gate API messages without purchase verbs", () => {
  const rewritten = rewriteMcpErrorMessageForHostSurface({
    message: "You're out of credits. Buy credits or enable top-ups to continue.",
    hostSurface: "CHATGPT_APP",
  });

  assert.equal(rewritten, CHATGPT_APP_ACCOUNT_GATE_MESSAGE);
  assert.equal(/buy|purchase|upgrade|top-?ups?/i.test(rewritten), false);
});

void test("STANDARD MCP leaves billing-gate API messages unchanged", () => {
  const message = "You're out of credits. Buy credits or enable top-ups to continue.";
  assert.equal(
    rewriteMcpErrorMessageForHostSurface({ message, hostSurface: "STANDARD" }),
    message,
  );
});

void test("ChatGPT Apps leaves unrelated errors unchanged", () => {
  const message = "File not found.";
  assert.equal(
    rewriteMcpErrorMessageForHostSurface({ message, hostSurface: "CHATGPT_APP" }),
    message,
  );
  assert.equal(getLooksLikeMcpBillingGateMessage({ message }), false);
});

void test("commerce reject copy never mentions purchase", () => {
  assert.equal(/buy|purchase|upgrade|top-?ups?/i.test(CHATGPT_APP_COMMERCE_DEEP_LINK_REJECTED_MESSAGE), false);
});
