import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatMcpAiStylePresetExamplesMarkdown } from "../adapters/aiStylePresetExamples";
import {
  CHATGPT_APP_CREDITS_GUIDANCE,
  type McpHostSurface,
  STANDARD_MCP_CREDITS_GUIDANCE,
} from "../hostSurface";

export type GuidanceDocument = {
  id: string;
  uri: string;
  resourceName: string;
  toolName: string;
  title: string;
  description: string;
  markdown: string;
};

/**
 * Markdown lives next to this module under `src/guidance/` in development / tests.
 * The published bundle inlines this file into `dist/index.js` / `dist/http.js`, so
 * build copies the same `.md` files to `dist/guidance/` for runtime reads.
 */
function resolveGuidanceDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const siblingMarker = join(here, "getting-started.md");
  if (existsSync(siblingMarker)) {
    return here;
  }

  const bundledDir = join(here, "guidance");
  const bundledMarker = join(bundledDir, "getting-started.md");
  if (existsSync(bundledMarker)) {
    return bundledDir;
  }

  throw new Error(
    `VideoGen MCP guidance markdown not found next to ${here} or under ${bundledDir}`,
  );
}

function loadMarkdown(filename: string): string {
  return readFileSync(join(resolveGuidanceDir(), filename), "utf8");
}

const CREDITS_GUIDANCE_BLOCK_PATTERN =
  /<!-- mcp-host-credits-guidance -->[\s\S]*?<!-- \/mcp-host-credits-guidance -->/;

const UPLOAD_GUIDANCE_BLOCK_PATTERN =
  /<!-- mcp-host-upload-guidance -->[\s\S]*?<!-- \/mcp-host-upload-guidance -->/;

const STANDARD_UPLOAD_GUIDANCE = `- **ChatGPT (hosted)**: call \`open_uploader\`. When the user already attached files in the chat, pass them in \`files\`. A filename is not the file and does not upload it.
- **Hosted remote**: \`upload_file\` with inline base64 for small files, or \`create_file_upload\` then \`PUT\` bytes to the returned URL, then \`get_file\` with \`wait: true\`.
- **Local stdio**: \`upload_file\` with a local \`filePath\`.`;

const CHATGPT_APP_UPLOAD_GUIDANCE = `- Call \`open_uploader\` to import a photo or file. When the user already attached files in the chat, pass each attachment in \`files\`. A filename is not the file and does not upload it.`;

const AI_STYLE_EXAMPLES_BLOCK_PATTERN =
  /<!-- mcp-ai-style-examples -->[\s\S]*?<!-- \/mcp-ai-style-examples -->/;

/** Inserts the full default-style table so workflow guidance can be copied verbatim. */
export const applyAiStylePresetExamples = ({
  markdown,
}: {
  markdown: string;
}): string => {
  return markdown.replace(
    AI_STYLE_EXAMPLES_BLOCK_PATTERN,
    formatMcpAiStylePresetExamplesMarkdown(),
  );
};

/** Swaps the getting-started credits block for STANDARD vs ChatGPT Apps policy. */
export const applyHostSurfaceCreditsGuidance = ({
  markdown,
  hostSurface,
}: {
  markdown: string;
  hostSurface: McpHostSurface;
}): string => {
  const replacement =
    hostSurface === "CHATGPT_APP" ? CHATGPT_APP_CREDITS_GUIDANCE : STANDARD_MCP_CREDITS_GUIDANCE;

  if (!CREDITS_GUIDANCE_BLOCK_PATTERN.test(markdown)) {
    throw new Error(
      "getting-started.md is missing the <!-- mcp-host-credits-guidance --> block required for host-specific credits copy.",
    );
  }

  return markdown.replace(CREDITS_GUIDANCE_BLOCK_PATTERN, replacement);
};

/** Swaps upload instructions so ChatGPT is not told to call tools that cannot see attachments. */
export const applyHostSurfaceUploadGuidance = ({
  markdown,
  hostSurface,
}: {
  markdown: string;
  hostSurface: McpHostSurface;
}): string => {
  const replacement =
    hostSurface === "CHATGPT_APP" ? CHATGPT_APP_UPLOAD_GUIDANCE : STANDARD_UPLOAD_GUIDANCE;

  if (!UPLOAD_GUIDANCE_BLOCK_PATTERN.test(markdown)) {
    throw new Error(
      "getting-started.md is missing the <!-- mcp-host-upload-guidance --> block required for host-specific upload copy.",
    );
  }

  return markdown.replace(UPLOAD_GUIDANCE_BLOCK_PATTERN, replacement);
};

const BASE_GUIDANCE_DOCUMENTS: readonly Omit<GuidanceDocument, "markdown">[] = [
  {
    id: "getting-started",
    uri: "guidance://getting-started",
    resourceName: "getting_started_guidance",
    toolName: "get_getting_started_guidance",
    title: "Getting started guidance",
    description:
      "How to authenticate, verify with get_me, introduce VideoGen with workflow example prompts, choose workflows vs media tools, and follow VideoGen id conventions. Call when connecting, onboarding, the user asks what VideoGen can do, or how to set up the API or MCP.",
  },
  {
    id: "async-tasks",
    uri: "guidance://async-tasks",
    resourceName: "async_tasks_guidance",
    toolName: "get_async_tasks_guidance",
    title: "Async tasks guidance",
    description:
      "How to handle async workflows, tool executions, and exports: statuses, hosted vs local wait caps, polling with get_* tools, and when webhooks apply outside MCP. Call before polling or when a start tool returns a still-running snapshot.",
  },
  {
    id: "workflows",
    uri: "guidance://workflows",
    resourceName: "workflows_guidance",
    toolName: "get_workflows_guidance",
    title: "Workflows guidance",
    description:
      "Canonical run → remix → export flow and when to use each workflow tool. Prefer script_to_video for longer narrated / informational videos; keep storyboard_to_video to ≤3 scenes unless the user asks for more. Call before starting a full video project.",
  },
  {
    id: "tools-vs-workflows",
    uri: "guidance://tools-vs-workflows",
    resourceName: "tools_vs_workflows_guidance",
    toolName: "get_tools_vs_workflows_guidance",
    title: "Tools vs workflows guidance",
    description:
      "When to use standalone media tools (automatic model routing for a single asset) versus workflows (full editable professional video). Call when choosing between generate_* tools and workflow tools.",
  },
];

const GUIDANCE_MARKDOWN_BY_ID: Record<string, string> = {
  "getting-started": loadMarkdown("getting-started.md"),
  "async-tasks": loadMarkdown("async-tasks.md"),
  workflows: loadMarkdown("workflows.md"),
  "tools-vs-workflows": loadMarkdown("tools-vs-workflows.md"),
};

export const getGuidanceDocuments = ({
  hostSurface,
}: {
  hostSurface: McpHostSurface;
}): readonly GuidanceDocument[] =>
  BASE_GUIDANCE_DOCUMENTS.map((doc) => {
    const rawMarkdown = GUIDANCE_MARKDOWN_BY_ID[doc.id];
    if (rawMarkdown == null) {
      throw new Error(`Missing guidance markdown for ${doc.id}`);
    }

    const markdown = (() => {
      if (doc.id === "getting-started") {
        return applyHostSurfaceUploadGuidance({
          markdown: applyHostSurfaceCreditsGuidance({
            markdown: rawMarkdown,
            hostSurface,
          }),
          hostSurface,
        });
      }

      if (doc.id === "workflows") {
        return applyAiStylePresetExamples({ markdown: rawMarkdown });
      }

      return rawMarkdown;
    })();

    return { ...doc, markdown };
  });

/** STANDARD-host documents (stdio / `/mcp`). Prefer getGuidanceDocuments for ChatGPT. */
export const GUIDANCE_DOCUMENTS: readonly GuidanceDocument[] =
  getGuidanceDocuments({ hostSurface: "STANDARD" });

export const GUIDANCE_MIME_TYPE = "text/markdown";
