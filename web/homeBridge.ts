/** MCP Apps bridge, using the same wire protocol as OpenAI's UI quickstart. */
export function createHomeBridge() {
  const surface = window;
  let nextId = 0;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const receive = (event: MessageEvent<unknown>): void => {
    if (event.source !== surface.parent) return;
    const message = event.data;
    if (
      typeof message !== "object" ||
      message == null ||
      !("jsonrpc" in message) ||
      message.jsonrpc !== "2.0" ||
      !("id" in message) ||
      typeof message.id !== "number"
    )
      return;
    const request = pending.get(message.id);
    if (request == null) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    request.resolve(
      "error" in message ? null : "result" in message ? message.result : null,
    );
  };
  surface.addEventListener("message", receive);

  const request = (
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> =>
    new Promise((resolve) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, 30_000);
      pending.set(id, { resolve, timer });
      surface.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
    });

  const ready = request("ui/initialize", {
    appInfo: { name: "videogen-home", version: "1.0.0" },
    appCapabilities: {},
    protocolVersion: "2026-01-26",
  }).then((result) => {
    if (result == null) return false;
    surface.parent.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/initialized",
        params: {},
      },
      "*",
    );
    return true;
  });

  return {
    async callTool(
      name: string,
      args: Record<string, unknown>,
    ): Promise<unknown> {
      if (!(await ready)) return null;
      return request("tools/call", { name, arguments: args });
    },
    async sendMessage(prompt: string): Promise<boolean> {
      if (!(await ready)) return false;
      const result = await request("ui/message", {
        role: "user",
        content: [{ type: "text", text: prompt }],
      });
      return (
        typeof result === "object" &&
        result != null &&
        (!("isError" in result) || result.isError !== true)
      );
    },
    dispose(): void {
      surface.removeEventListener("message", receive);
      for (const { resolve, timer } of pending.values()) {
        clearTimeout(timer);
        resolve(null);
      }
      pending.clear();
    },
  };
}

type HomeProject = {
  projectId: string;
  title: string;
  projectUrl: string;
};

/** Validate untrusted host responses without shipping Zod in the browser. */
export function readHomeProjects(result: unknown): HomeProject[] | null {
  if (typeof result !== "object" || result == null) return null;
  if ("isError" in result && result.isError === true) return null;
  let payload: unknown =
    "structuredContent" in result ? result.structuredContent : null;
  if (payload == null && "content" in result && Array.isArray(result.content)) {
    const content: unknown[] = result.content;
    for (const item of content) {
      if (
        typeof item !== "object" ||
        item == null ||
        !("text" in item) ||
        typeof item.text !== "string"
      )
        continue;
      try {
        payload = JSON.parse(item.text);
      } catch {
        return null;
      }
      break;
    }
  }
  if (
    typeof payload !== "object" ||
    payload == null ||
    !("projects" in payload) ||
    !Array.isArray(payload.projects)
  )
    return null;
  const projects: HomeProject[] = [];
  const rows: unknown[] = payload.projects;
  for (const project of rows) {
    if (
      typeof project !== "object" ||
      project == null ||
      !("projectId" in project) ||
      typeof project.projectId !== "string" ||
      !("title" in project) ||
      typeof project.title !== "string" ||
      !("projectUrl" in project) ||
      typeof project.projectUrl !== "string"
    )
      return null;
    projects.push({
      projectId: project.projectId,
      title: project.title,
      projectUrl: project.projectUrl,
    });
  }
  return projects;
}

export function getSafeHomeLink(href: string, appUrl: string): string | null {
  try {
    const url = new URL(href, appUrl);
    if (url.origin !== new URL(appUrl).origin) return null;
    return url.href;
  } catch {
    return null;
  }
}
