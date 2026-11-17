import { useEffect, useRef, type ReactElement } from "react";
import { createHomeBridge } from "./homeBridge";

/** The product lives in frontend/. Keep this wrapper free of product logic. */
export function HomePage({ appUrl }: { appUrl: string }): ReactElement {
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<ReturnType<typeof createHomeBridge> | null>(null);
  useEffect(() => {
    const client = createHomeBridge({
      appOrigin: new URL(appUrl).origin,
      getAppWindow: () => frame.current?.contentWindow ?? null,
    });
    bridge.current = client;
    return () => { bridge.current = null; client.dispose(); };
  }, [appUrl]);
  return <div style={{ height: "100dvh", width: "100%", background: "white" }}>
    <iframe
      ref={frame}
      data-testid="videogen-embedded-app"
      title="VideoGen"
      src={new URL("/chatgpt/", appUrl).href}
      onLoad={() => bridge.current?.requestContext()}
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
      allow="clipboard-write; fullscreen"
      referrerPolicy="no-referrer"
      style={{ display: "block", width: "100%", height: "100%", border: 0, background: "white" }}
    />
  </div>;
}
