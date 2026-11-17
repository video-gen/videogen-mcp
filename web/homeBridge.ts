import { registerOpenInAppTarget } from "./registerOpenInAppTarget";

/** Only the expected app frame can publish a project selection. No tool/auth proxy. */
export function createHomeBridge({ appOrigin, getAppWindow }: {
  appOrigin: string;
  getAppWindow: () => Window | null;
}) {
  const surface = window;
  const disposeOpenInAppTarget = registerOpenInAppTarget(appOrigin);
  const requestId = "videogen-embedded-app-init";
  let ready = false;
  let hasContext = false;
  let projectId: string | null = null;
  let nextId = 0;
  let externalRequest: { hostId: string; requestId: string; appWindow: Window; timeout: ReturnType<typeof setTimeout> } | null = null;
  const finishExternal = (opened: boolean): void => {
    const pending = externalRequest;
    if (pending == null) return;
    externalRequest = null;
    clearTimeout(pending.timeout);
    pending.appWindow.postMessage({ type: "videogen:google-signin-opened", requestId: pending.requestId, opened }, appOrigin);
  };
  const publishContext = (): void => {
    if (!ready || !hasContext) return;
    surface.parent.postMessage({
      jsonrpc: "2.0", id: `videogen-context-${++nextId}`, method: "ui/update-model-context",
      params: { structuredContent: { videogen: { projectId } } },
    }, "*");
  };
  const requestContext = (): void => getAppWindow()?.postMessage({ type: "videogen:request-context" }, appOrigin);
  const receive = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    if (message == null || typeof message !== "object") return;
    const appWindow = getAppWindow();
    if (appWindow != null && event.source === appWindow && event.origin === appOrigin && "type" in message && message.type === "videogen:context-ready") {
      requestContext();
      return;
    }
    if (appWindow != null && event.source === appWindow && event.origin === appOrigin && "type" in message && message.type === "videogen:cancel-google-signin-open") {
      if (externalRequest != null && "requestId" in message && message.requestId === externalRequest.requestId) finishExternal(false);
      return;
    }
    if (appWindow != null && event.source === appWindow && event.origin === appOrigin && "type" in message && message.type === "videogen:open-google-signin") {
      if (!("requestId" in message) || typeof message.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(message.requestId)) return;
      const deny = (): void => appWindow.postMessage({ type: "videogen:google-signin-opened", requestId: message.requestId, opened: false }, appOrigin);
      if (!ready || externalRequest != null || !("href" in message) || typeof message.href !== "string" || message.href.length > 16_384) { deny(); return; }
      try {
        const target = new URL(message.href);
        if (target.origin !== appOrigin || target.username !== "" || target.password !== "" || target.pathname !== "/chatgpt/google-start" || !target.hash.startsWith("#authorize=")) { deny(); return; }
        const hostId = `videogen-google-open-${++nextId}`;
        externalRequest = { hostId, requestId: message.requestId, appWindow, timeout: setTimeout(() => finishExternal(false), 12_000) };
        surface.parent.postMessage({ jsonrpc: "2.0", id: hostId, method: "ui/open-link", params: { url: target.href } }, "*");
      } catch {
        if (externalRequest?.requestId === message.requestId) finishExternal(false);
        else deny();
      }
      return;
    }
    if (appWindow != null && event.source === appWindow && event.origin === appOrigin && "type" in message && message.type === "videogen:project-context" && "projectId" in message) {
      const id = message.projectId ?? null;
      if (id != null && (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return;
      if (hasContext && projectId === id) return;
      hasContext = true;
      projectId = id;
      publishContext();
      return;
    }
    if (event.source !== surface.parent || !("jsonrpc" in message) || message.jsonrpc !== "2.0") return;
    if (externalRequest != null && "id" in message && message.id === externalRequest.hostId) {
      if ("error" in message) finishExternal(false);
      else if ("result" in message) {
        const result = message.result;
        finishExternal(result != null && typeof result === "object" && !("isError" in result && result.isError === true));
      }
      return;
    }
    if (ready || !("id" in message) || message.id !== requestId || !("result" in message) || "error" in message) return;
    ready = true;
    surface.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} }, "*");
    // Otherwise ChatGPT opens widgetDomain, which is the MCP server's JSON root.
    surface.openai?.setOpenInAppUrl?.({ href: appOrigin });
    publishContext();
    requestContext();
  };
  surface.addEventListener("message", receive);
  surface.parent.postMessage({
    jsonrpc: "2.0", id: requestId, method: "ui/initialize",
    params: {
      appInfo: { name: "videogen-embedded-app", version: "2.5.4" },
      appCapabilities: { availableDisplayModes: ["fullscreen"] },
      protocolVersion: "2026-01-26",
    },
  }, "*");
  return { requestContext, dispose(): void {
    disposeOpenInAppTarget();
    finishExternal(false);
    surface.removeEventListener("message", receive);
  } };
}
