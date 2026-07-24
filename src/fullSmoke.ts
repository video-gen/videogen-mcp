import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/**
 * Full-coverage smoke battery for the VideoGen MCP server.
 *
 * Where the basic smoke only proves the handshake, `tools/list`, and a read-only
 * `get_me`, this exercises EVERY HOSTED tool the server registers with real
 * requests against the deployed environment — uploading real fixtures, running
 * every media/generation tool and every workflow to a terminal state, editing and
 * exporting the resulting project, and driving the account/resource/file/project
 * read tools. It intentionally spends credits and can take a long time (each
 * generation and workflow is awaited to completion): it is meant to run inside the
 * "run all tests" background job, not as a quick local check.
 *
 * Design:
 *   - Steps run in dependency order, threading real ids (voice, presenter, file,
 *     tool-execution, workflow-run, project) captured from earlier responses into
 *     later calls. Ids are extracted from the returned JSON by their `vg_..._`
 *     prefix, so this stays robust to minor response-shape changes.
 *   - Every registered HOSTED tool must appear in `tools/list` (missing → fail).
 *   - Each step is MUST-PASS unless flagged best-effort. Best-effort steps
 *     (`slideshow_to_video`, `storyboard_to_video`) are called for coverage but
 *     don't fail the suite: slideshow depends on a synthesized PDF fixture whose
 *     rendering quality we don't control, and storyboard_to_video has no
 *     implementation in the current SDK (see the tool's own comment). They are
 *     still invoked and their outcome logged.
 *   - Long-running (awaited) calls pass a large client-side request timeout so the
 *     server's built-in wait-to-terminal polling isn't cut off by the SDK's 60s
 *     default.
 */

// Every tool registered on the HOSTED (Streamable HTTP) server — see
// registerTools + registerUploadWidget. tools/list must expose all of them.
const ALL_HOSTED_TOOLS = [
  // workflows
  "script_to_video",
  "voiceover_to_video",
  "slideshow_to_video",
  "storyboard_to_video",
  "prompt_to_video_clip",
  "list_workflow_runs",
  "get_workflow_run",
  "cancel_workflow_run",
  // media tools
  "generate_image",
  "generate_video_clip",
  "text_to_speech",
  "generate_sound_effect",
  "generate_music",
  "generate_motion_graphic",
  "generate_avatar",
  "vectorize_image",
  "remove_image_background",
  "remove_video_background",
  "upscale_image",
  "upscale_video",
  "image_3d_effect",
  "list_tool_executions",
  "get_tool_execution",
  "cancel_tool_execution",
  // projects
  "list_projects",
  "get_project",
  "export_project",
  "remix_project",
  "list_project_remix_actions",
  // files
  "upload_file",
  "create_file_upload",
  "get_file",
  "list_files",
  // resources
  "list_avatar_presenters",
  "list_tts_voices",
  "list_languages",
  // account
  "get_me",
  // upload widget (HOSTED only)
  "open_uploader",
];

// Tools whose failure is logged but does not fail the suite. See the module doc.
const BEST_EFFORT_TOOLS = new Set(["slideshow_to_video", "storyboard_to_video"]);

// Long-running awaited calls (generation/workflow/export) can take many minutes.
// The client request timeout must comfortably exceed the server-side wait window
// so the SDK's 60s default doesn't abort the server's wait-to-terminal poll.
const LONG_CALL_TIMEOUT_MS = 25 * 60 * 1000;

// Server-side wait window: how long a composite tool polls for a terminal state
// before returning the latest (possibly non-terminal) snapshot. Kept under the
// client timeout above.
const LONG_POLL_TIMEOUT_MS = 20 * 60 * 1000;

// A valid 1x1 transparent PNG, used as the source image for image tools.
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

type IdPrefix = "vg_file_" | "vg_tool_" | "vg_work_" | "vg_proj_" | "vg_voic_" | "vg_pres_";

const readProp = (value: unknown, key: string): unknown =>
  value != null && typeof value === "object" ? Reflect.get(value, key) : undefined;

const readString = (value: unknown, key: string): string | undefined => {
  const prop = readProp(value, key);
  return typeof prop === "string" ? prop : undefined;
};

// Depth-first search for the first string anywhere in a parsed-JSON tree that
// satisfies `predicate`. Used to pull ids out of loosely-typed tool responses.
function deepFindString(value: unknown, predicate: (candidate: string) => boolean): string | null {
  if (typeof value === "string") {
    return predicate(value) ? value : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = deepFindString(entry, predicate);
      if (found != null) {
        return found;
      }
    }

    return null;
  }

  if (value != null && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const found = deepFindString(entry, predicate);
      if (found != null) {
        return found;
      }
    }
  }

  return null;
}

const findPrefixedId = (value: unknown, prefix: IdPrefix): string | null =>
  deepFindString(value, (candidate) => candidate.startsWith(prefix));

// A generated tool execution's terminal snapshot carries `results: [{ fileId, type }]`.
// Return the first output file id (optionally matching a type) so it can feed a
// downstream tool that needs a source asset.
function findResultFileId(value: unknown, type?: "IMAGE" | "VIDEO" | "AUDIO"): string | null {
  const results = readProp(value, "results");

  if (Array.isArray(results)) {
    for (const entry of results) {
      const fileId = readString(entry, "fileId");
      const entryType = readString(entry, "type");

      if (fileId != null && (type == null || entryType === type)) {
        return fileId;
      }
    }
  }

  // Fall back to any file id in the payload (single-result tools may not nest).
  return findPrefixedId(value, "vg_file_");
}

// Pulls the first `{ type: "text" }` block out of a CallToolResult's content.
function extractResultText(result: unknown): string {
  const content = readProp(result, "content");

  if (Array.isArray(content)) {
    for (const entry of content) {
      if (readString(entry, "type") === "text") {
        const text = readString(entry, "text");
        if (text != null) {
          return text;
        }
      }
    }
  }

  return "";
}

const truncate = (text: string, max = 400): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

// A composite (start + poll) tool returns its latest snapshot without setting
// `isError`, even when the operation ended in a terminal failure or never
// finished within the wait window. So after an awaited generation/workflow/export
// we must inspect the snapshot: a `downloadUrl` or `status: "succeeded"` is a
// genuine success; "failed"/"cancelled" is a real failure; anything else means it
// didn't reach a terminal state in time.
function assertTerminalSuccess(json: unknown, label: string): void {
  const downloadUrl = readString(json, "downloadUrl");

  if (downloadUrl != null && downloadUrl !== "") {
    return;
  }

  const status = readString(json, "status");

  if (status == null) {
    // No status field to check (some read tools) — treat a non-error result as ok.
    return;
  }

  const normalized = status.toLowerCase();

  if (normalized === "succeeded") {
    return;
  }

  if (normalized === "failed" || normalized === "cancelled" || normalized === "canceled") {
    const errorMessage = readString(readProp(json, "error"), "message");
    throw new Error(
      `${label} ended in status "${status}"${errorMessage != null ? `: ${errorMessage}` : ""}`,
    );
  }

  throw new Error(`${label} did not reach a terminal state in time (status "${status}")`);
}

/**
 * Per-case credit sampling. The "run all tests" job injects
 * `TEST_SAMPLE_RATE_PERCENT` into this suite's env (see `runTestSuite`); each
 * sampleable (credit-costing, leaf) step is then independently kept with
 * probability `rate / 100`. Absent / empty / invalid / >= 100 means 100 (run
 * everything, e.g. locally); 0 means run none. Kept local because the mcp package
 * has no `@videogen/*` dependency — mirrors `getShouldRunSampledTestCase` in
 * `@videogen/base`.
 */
const getShouldRunSampledStep = (): boolean => {
  const rawValue = process.env.TEST_SAMPLE_RATE_PERCENT;

  if (rawValue == null || rawValue === "") {
    return true;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) {
    return true;
  }

  if (parsed <= 0) {
    return false;
  }

  return Math.random() * 100 < parsed;
};

type Log = (message: string) => void;

type StepStatus = "pass" | "fail" | "skip";

type StepOutcome = { name: string; status: StepStatus; detail: string };

export async function runFullCoverage({
  client,
  log,
  toolNames,
}: {
  client: Client;
  log: Log;
  toolNames: Set<string>;
}): Promise<void> {
  const outcomes: StepOutcome[] = [];

  // ---- coverage: every registered HOSTED tool must be advertised ----
  const missingTools = ALL_HOSTED_TOOLS.filter((name) => !toolNames.has(name));

  if (missingTools.length > 0) {
    throw new Error(`tools/list is missing expected HOSTED tools: ${missingTools.join(", ")}`);
  }

  log(`[mcp-smoke] full coverage: ${ALL_HOSTED_TOOLS.length} tools advertised, exercising each...`);

  // Invokes a tool, throwing on an error result so a step can `await` it directly.
  // `longRunning` widens the client request timeout for awaited generations.
  const call = async (
    name: string,
    args: Record<string, unknown>,
    { longRunning = false }: { longRunning?: boolean } = {},
  ): Promise<unknown> => {
    // For awaited long-running tools, widen the server-side wait window (unless the
    // caller set its own) so the poll doesn't return a still-running snapshot early.
    const finalArgs =
      longRunning && args.timeoutMs == null ? { ...args, timeoutMs: LONG_POLL_TIMEOUT_MS } : args;
    const result = await client.callTool(
      { name, arguments: finalArgs },
      undefined,
      longRunning ? { timeout: LONG_CALL_TIMEOUT_MS, maxTotalTimeout: LONG_CALL_TIMEOUT_MS } : {},
    );
    const text = extractResultText(result);

    if (readProp(result, "isError") === true) {
      throw new Error(`isError: ${truncate(text)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };

  // Runs one named step, recording its outcome. A best-effort step that throws is
  // recorded as `skip` (logged, non-fatal); any other throw is a `fail`.
  // `sampleable` steps are credit-costing leaves (nothing downstream depends on
  // them); when the run's credit sample rate excludes one it is recorded as a
  // (non-fatal) `skip` and its tool is never called, bounding spend without
  // breaking the id-threading of the always-run steps.
  const step = async (
    name: string,
    fn: () => Promise<string | void>,
    { sampleable = false }: { sampleable?: boolean } = {},
  ): Promise<void> => {
    if (sampleable && !getShouldRunSampledStep()) {
      outcomes.push({ name, status: "skip", detail: "sampled out (TEST_SAMPLE_RATE_PERCENT)" });
      log(`  ⊘ ${name} (sampled out this run, non-fatal)`);
      return;
    }

    try {
      const detail = (await fn()) ?? "";
      outcomes.push({ name, status: "pass", detail });
      log(`  ✓ ${name}${detail !== "" ? ` — ${detail}` : ""}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (BEST_EFFORT_TOOLS.has(name)) {
        outcomes.push({ name, status: "skip", detail: message });
        log(`  ⚠ ${name} (best-effort, non-fatal) — ${message}`);
      } else {
        outcomes.push({ name, status: "fail", detail: message });
        log(`  ✗ ${name} — ${message}`);
      }
    }
  };

  // Shared context threaded across steps.
  const ctx: {
    voiceId?: string;
    presenterId?: string;
    imageFileId?: string;
    audioFileId?: string;
    videoFileId?: string;
    pdfFileId?: string;
    toolExecutionId?: string;
    workflowRunId?: string;
    projectId?: string;
  } = {};

  // ---- account + read-only resource/list tools ----
  await step("get_me", async () => {
    await call("get_me", {});
  });

  await step("list_languages", async () => {
    await call("list_languages", {});
  });

  await step("list_tts_voices", async () => {
    const json = await call("list_tts_voices", { limit: 5 });
    ctx.voiceId = findPrefixedId(json, "vg_voic_") ?? undefined;
    return ctx.voiceId != null ? `voiceId=${ctx.voiceId}` : "no voices returned";
  });

  await step("list_avatar_presenters", async () => {
    const json = await call("list_avatar_presenters", { limit: 5 });
    ctx.presenterId = findPrefixedId(json, "vg_pres_") ?? undefined;
    return ctx.presenterId != null ? `presenterId=${ctx.presenterId}` : "no presenters returned";
  });

  await step("list_files", async () => {
    await call("list_files", { limit: 5 });
  });

  await step("list_projects", async () => {
    await call("list_projects", { limit: 5 });
  });

  await step("list_tool_executions", async () => {
    await call("list_tool_executions", { limit: 5 });
  });

  await step("list_workflow_runs", async () => {
    await call("list_workflow_runs", { limit: 5 });
  });

  // ---- uploads (image via inline base64; PDF via pre-signed PUT) ----
  await step("upload_file", async () => {
    const json = await call("upload_file", {
      fileData: PNG_1X1_BASE64,
      displayName: "mcp-smoke.png",
      type: "IMAGE",
    });
    ctx.imageFileId = findPrefixedId(json, "vg_file_") ?? undefined;

    if (ctx.imageFileId == null) {
      throw new Error("upload did not return a file id");
    }

    return `imageFileId=${ctx.imageFileId}`;
  });

  await step("get_file", async () => {
    if (ctx.imageFileId == null) {
      throw new Error("no uploaded image file id to fetch");
    }

    await call("get_file", { fileId: ctx.imageFileId });
    return `fileId=${ctx.imageFileId}`;
  });

  await step("create_file_upload", async () => {
    const json = await call("create_file_upload", {
      displayName: "mcp-smoke.pdf",
      type: "PDF",
    });
    const fileId = findPrefixedId(json, "vg_file_");
    const uploadUrl = readString(json, "uploadUrl");

    if (fileId == null || uploadUrl == null) {
      throw new Error("did not return { fileId, uploadUrl }");
    }

    const pdfBytes = buildMinimalPdf();
    // Pre-signed URL: PUT the raw bytes with NO Authorization header.
    const putResponse = await fetch(uploadUrl, { method: "PUT", body: pdfBytes });

    if (!putResponse.ok) {
      throw new Error(`PUT to pre-signed URL failed: ${putResponse.status}`);
    }

    // Wait until the uploaded PDF finishes processing so it can drive a workflow.
    await call("get_file", { fileId, wait: true, timeoutMs: 120000 }, { longRunning: true });
    ctx.pdfFileId = fileId;
    return `pdfFileId=${fileId}`;
  });

  // ---- media generation tools (spend credits; awaited to terminal) ----
  await step("generate_image", async () => {
    const json = await call(
      "generate_image",
      { prompt: "A single red apple on a plain white background, product photo.", quality: "LOW" },
      { longRunning: true },
    );
    assertTerminalSuccess(json, "generate_image");
    ctx.toolExecutionId = findPrefixedId(json, "vg_tool_") ?? ctx.toolExecutionId;
    const outputFileId = findResultFileId(json, "IMAGE");
    return outputFileId != null ? `outputFileId=${outputFileId}` : "generated";
  });

  await step("text_to_speech", async () => {
    if (ctx.voiceId == null) {
      throw new Error("no voice id available from list_tts_voices");
    }

    const json = await call(
      "text_to_speech",
      { ttsText: "This is a VideoGen MCP smoke test.", voiceId: ctx.voiceId },
      { longRunning: true },
    );
    assertTerminalSuccess(json, "text_to_speech");
    ctx.audioFileId = findResultFileId(json, "AUDIO") ?? undefined;
    return ctx.audioFileId != null ? `audioFileId=${ctx.audioFileId}` : "generated";
  });

  await step(
    "generate_sound_effect",
    async () => {
      const json = await call(
        "generate_sound_effect",
        { prompt: "A short, gentle notification chime.", durationSeconds: 2 },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "generate_sound_effect");
    },
    { sampleable: true },
  );

  await step(
    "generate_music",
    async () => {
      const json = await call(
        "generate_music",
        { prompt: "Upbeat corporate background music, 10 seconds." },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "generate_music");
    },
    { sampleable: true },
  );

  await step(
    "generate_motion_graphic",
    async () => {
      const json = await call(
        "generate_motion_graphic",
        { prompt: "The word 'VideoGen' typing on in a clean sans-serif.", durationSeconds: 3 },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "generate_motion_graphic");
    },
    { sampleable: true },
  );

  await step("generate_video_clip", async () => {
    const json = await call(
      "generate_video_clip",
      { quality: "STANDARD", prompt: "A calm ocean wave rolling onto a sandy beach.", durationSeconds: 5 },
      { longRunning: true },
    );
    assertTerminalSuccess(json, "generate_video_clip");
    ctx.videoFileId = findResultFileId(json, "VIDEO") ?? undefined;
    return ctx.videoFileId != null ? `videoFileId=${ctx.videoFileId}` : "generated";
  });

  await step(
    "generate_avatar",
    async () => {
      if (ctx.presenterId == null || ctx.audioFileId == null) {
        throw new Error(
          `missing prerequisite (presenterId=${ctx.presenterId ?? "none"}, audioFileId=${ctx.audioFileId ?? "none"})`,
        );
      }

      const json = await call(
        "generate_avatar",
        { avatarPresenterId: ctx.presenterId, audioFileId: ctx.audioFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "generate_avatar");
    },
    { sampleable: true },
  );

  await step(
    "vectorize_image",
    async () => {
      if (ctx.imageFileId == null) {
        throw new Error("no source image file id");
      }

      const json = await call(
        "vectorize_image",
        { imageFileId: ctx.imageFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "vectorize_image");
    },
    { sampleable: true },
  );

  await step(
    "remove_image_background",
    async () => {
      if (ctx.imageFileId == null) {
        throw new Error("no source image file id");
      }

      const json = await call(
        "remove_image_background",
        { imageFileId: ctx.imageFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "remove_image_background");
    },
    { sampleable: true },
  );

  await step(
    "upscale_image",
    async () => {
      if (ctx.imageFileId == null) {
        throw new Error("no source image file id");
      }

      const json = await call(
        "upscale_image",
        { imageFileId: ctx.imageFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "upscale_image");
    },
    { sampleable: true },
  );

  await step(
    "image_3d_effect",
    async () => {
      if (ctx.imageFileId == null) {
        throw new Error("no source image file id");
      }

      const json = await call(
        "image_3d_effect",
        { imageFileId: ctx.imageFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "image_3d_effect");
    },
    { sampleable: true },
  );

  await step(
    "remove_video_background",
    async () => {
      if (ctx.videoFileId == null) {
        throw new Error("no source video file id from generate_video_clip");
      }

      const json = await call(
        "remove_video_background",
        { videoFileId: ctx.videoFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "remove_video_background");
    },
    { sampleable: true },
  );

  await step(
    "upscale_video",
    async () => {
      if (ctx.videoFileId == null) {
        throw new Error("no source video file id from generate_video_clip");
      }

      const json = await call(
        "upscale_video",
        { videoFileId: ctx.videoFileId },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "upscale_video");
    },
    { sampleable: true },
  );

  await step("get_tool_execution", async () => {
    if (ctx.toolExecutionId == null) {
      throw new Error("no tool execution id captured");
    }

    await call("get_tool_execution", { toolExecutionId: ctx.toolExecutionId });
    return `toolExecutionId=${ctx.toolExecutionId}`;
  });

  await step("cancel_tool_execution", async () => {
    // Start a fresh execution without waiting so there is something in-flight to cancel.
    const started = await call("generate_image", {
      prompt: "A blue circle on a white background.",
      quality: "LOW",
      wait: false,
    });
    const toolExecutionId = findPrefixedId(started, "vg_tool_");

    if (toolExecutionId == null) {
      throw new Error("could not start an execution to cancel");
    }

    await call("cancel_tool_execution", { toolExecutionId });
    return `cancelled ${toolExecutionId}`;
  });

  // ---- workflows (spend credits; awaited to terminal) ----
  await step("script_to_video", async () => {
    const json = await call(
      "script_to_video",
      {
        script: "Welcome to VideoGen. This is a short automated smoke test of the script to video workflow.",
        visualStyle: { type: "STOCK" },
        remixActions: [{ type: "ENABLE_CAPTIONS" }, { type: "SET_BACKGROUND_MUSIC" }],
      },
      { longRunning: true },
    );
    assertTerminalSuccess(json, "script_to_video");
    ctx.projectId = findPrefixedId(json, "vg_proj_") ?? undefined;
    ctx.workflowRunId = findPrefixedId(json, "vg_work_") ?? ctx.workflowRunId;
    return `projectId=${ctx.projectId ?? "none"} workflowRunId=${ctx.workflowRunId ?? "none"}`;
  });

  await step(
    "voiceover_to_video",
    async () => {
      if (ctx.audioFileId == null) {
        throw new Error("no audio file id from text_to_speech");
      }

      const json = await call(
        "voiceover_to_video",
        { fileId: ctx.audioFileId, visualStyle: { type: "STOCK" } },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "voiceover_to_video");
    },
    { sampleable: true },
  );

  await step("slideshow_to_video", async () => {
    if (ctx.pdfFileId == null) {
      throw new Error("no PDF file id from create_file_upload");
    }

    const json = await call("slideshow_to_video", { fileId: ctx.pdfFileId }, { longRunning: true });
    assertTerminalSuccess(json, "slideshow_to_video");
  });

  await step(
    "prompt_to_video_clip",
    async () => {
      const json = await call(
        "prompt_to_video_clip",
        { prompt: "A time-lapse of clouds moving over a mountain range.", durationSeconds: 5 },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "prompt_to_video_clip");
    },
    { sampleable: true },
  );

  await step("storyboard_to_video", async () => {
    const json = await call(
      "storyboard_to_video",
      {
        scenes: [
          { narration: "Scene one.", generation: { type: "STOCK" } },
          { narration: "Scene two.", generation: { type: "STOCK" } },
        ],
      },
      { longRunning: true },
    );
    assertTerminalSuccess(json, "storyboard_to_video");
  });

  await step("get_workflow_run", async () => {
    const workflowRunId = ctx.workflowRunId ?? (await resolveAnyWorkflowRunId(call));

    if (workflowRunId == null) {
      throw new Error("no workflow run id available");
    }

    await call("get_workflow_run", { workflowRunId });
    return `workflowRunId=${workflowRunId}`;
  });

  await step("cancel_workflow_run", async () => {
    // Start a fresh run without waiting so there is something in-flight to cancel.
    const started = await call("script_to_video", {
      script: "A run started only to be cancelled by the smoke test.",
      visualStyle: { type: "STOCK" },
      wait: false,
    });
    const workflowRunId = findPrefixedId(started, "vg_work_");

    if (workflowRunId == null) {
      throw new Error("could not start a run to cancel");
    }

    await call("cancel_workflow_run", { workflowRunId });
    return `cancelled ${workflowRunId}`;
  });

  // ---- projects (edit + export the project script_to_video produced) ----
  await step("get_project", async () => {
    const projectId = ctx.projectId ?? (await resolveAnyProjectId(call));

    if (projectId == null) {
      throw new Error("no project id available");
    }

    ctx.projectId = projectId;
    await call("get_project", { projectId });
    return `projectId=${projectId}`;
  });

  await step(
    "remix_project",
    async () => {
      if (ctx.projectId == null) {
        throw new Error("no project id available");
      }

      await call("remix_project", {
        projectId: ctx.projectId,
        remixActions: [{ type: "ENABLE_CAPTIONS" }, { type: "SET_BACKGROUND_MUSIC" }],
      });
    },
    { sampleable: true },
  );

  await step("list_project_remix_actions", async () => {
    if (ctx.projectId == null) {
      throw new Error("no project id available");
    }

    await call("list_project_remix_actions", { projectId: ctx.projectId });
  });

  await step(
    "export_project",
    async () => {
      if (ctx.projectId == null) {
        throw new Error("no project id available");
      }

      const json = await call(
        "export_project",
        { projectId: ctx.projectId, quality: "STANDARD" },
        { longRunning: true },
      );
      assertTerminalSuccess(json, "export_project");
    },
    { sampleable: true },
  );

  // ---- ChatGPT App upload widget (static render tool) ----
  await step("open_uploader", async () => {
    await call("open_uploader", {});
  });

  // ---- summary ----
  const passed = outcomes.filter((outcome) => outcome.status === "pass");
  const skipped = outcomes.filter((outcome) => outcome.status === "skip");
  const failed = outcomes.filter((outcome) => outcome.status === "fail");

  log(
    `[mcp-smoke] full coverage summary: ${passed.length} passed, ${skipped.length} skipped (best-effort), ${failed.length} failed`,
  );

  if (failed.length > 0) {
    throw new Error(
      `full coverage failed for ${failed.length} tool(s): ${failed
        .map((outcome) => `${outcome.name} (${outcome.detail})`)
        .join("; ")}`,
    );
  }
}

// Falls back to the most recent workflow run when a run id wasn't captured from a
// generation step (e.g. the terminal snapshot omitted it).
async function resolveAnyWorkflowRunId(
  call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<string | null> {
  const json = await call("list_workflow_runs", { limit: 1 });
  return findPrefixedId(json, "vg_work_");
}

async function resolveAnyProjectId(
  call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<string | null> {
  const json = await call("list_projects", { limit: 1, includeUiProjects: true });
  return findPrefixedId(json, "vg_proj_");
}

// Builds a minimal, structurally-valid single-page PDF with correct xref byte
// offsets so it can be uploaded and rendered by slideshow_to_video. Kept tiny and
// dependency-free (ASCII only, so char length == byte length for the offsets).
function buildMinimalPdf(): Uint8Array {
  const header = "%PDF-1.4\n";
  const streamContent = "BT /F1 24 Tf 72 700 Td (VideoGen MCP smoke slide) Tj ET";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  const offsets: number[] = [];
  let cursor = header.length;
  let body = "";

  for (const object of objects) {
    offsets.push(cursor);
    body += object;
    cursor += object.length;
  }

  const xrefStart = cursor;
  const objectCount = objects.length + 1;
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(header + body + xref + trailer, "latin1"));
}
