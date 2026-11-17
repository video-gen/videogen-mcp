import { registerOpenInAppTarget } from "./registerOpenInAppTarget";

/** Complete the MCP Apps handshake before the host delivers widget input/results. */
export function initializeWidgetBridge(appName: string): void {
  const appUrl = document.getElementById(`${appName}-root`)?.dataset.appUrl;
  if (appUrl != null) registerOpenInAppTarget(appUrl);
  const requestId = "videogen-widget-init";

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== window.parent) {
      return;
    }

    const message = event.data;
    if (
      typeof message !== "object" ||
      message == null ||
      !("jsonrpc" in message) ||
      message.jsonrpc !== "2.0" ||
      !("id" in message) ||
      message.id !== requestId ||
      "error" in message ||
      !("result" in message) ||
      typeof message.result !== "object" ||
      message.result == null
    ) {
      return;
    }

    window.removeEventListener("message", onMessage);
    window.parent.postMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/initialized",
      params: {},
    }, "*");
    if (appUrl != null) window.openai?.setOpenInAppUrl?.({ href: appUrl });
  };

  window.addEventListener("message", onMessage);
  window.parent.postMessage({
    jsonrpc: "2.0",
    id: requestId,
    method: "ui/initialize",
    params: {
      appInfo: { name: appName, version: "2.5.4" },
      appCapabilities: {},
      protocolVersion: "2026-01-26",
    },
  }, "*");
}
