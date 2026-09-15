# Getting started with VideoGen MCP

You are helping a user connect to VideoGen and produce video or media through this MCP server. **Read the Fast Path first.** Drop into deeper sections only when the situation calls for it.

For end-to-end video pipelines, call `get_workflows_guidance` next. For polling and hosted wait behavior, call `get_async_tasks_guidance`. To choose between a full workflow and a single media tool, call `get_tools_vs_workflows_guidance`.

When the user asks what VideoGen can do, lead with finished-video workflows and give pretty example prompts. Do not open with a motion graphic, countdown, or other single-asset tool.

Good first examples:

- "Make a one-minute 16:9 video explaining how compound interest works, with cinematic visuals and an energetic voiceover"
- "Make a 3-scene vertical UGC ad for my new water bottle, with handheld phone energy, a punchy voiceover, and a clear call to action at the end"

Mention `generate_*` media tools only if they ask for one image, clip, overlay, or transform.

---

## Fast Path: connect and verify

### Step 1 — Confirm authentication is in place

This server runs API calls as the linked VideoGen team. Auth is already configured when:

- **Remote MCP** (`https://mcp.videogen.io/mcp`): the host sent `Authorization: Bearer sk_videogen_live_...`, or the user completed Sign in with VideoGen (OAuth).
- **Local stdio**: `VIDEOGEN_API_KEY` is set in the MCP server env.

Do not invent or paste a key from chat history. If tools return auth errors, ask the user to add a key at [app.videogen.io/api](https://app.videogen.io/api) or complete OAuth linking. The full key is shown only once when created.

### Step 2 — Verify with `get_me`

Call `get_me` (no arguments). A successful result includes `email`, `teamId`, and key metadata. That means the credential works.

If this fails with 401, stop and fix auth before starting workflows or tools (those spend credits).

### Step 3 — Pick the right surface

| Goal | What to use |
| --- | --- |
| Full narrated multi-scene video (editable project plus MP4) | A workflow tool: prefer `script_to_video` for ~1 minute+ / informational text; use `storyboard_to_video` only for short shot lists (≤ 3 scenes unless the user asks for more); also `voiceover_to_video`, `slideshow_to_video`, `prompt_to_video_clip`. Wait for `downloadUrl`. |
| One image, clip, voiceover, music, avatar, or transform | A media tool: `generate_image`, `generate_video_clip`, `text_to_speech`, etc. |
| Reusable actor / product / visual style | `create_entity` + `add_entity_reference` (upload the image first), then pass `vg_enti_...` into workflows / `generate_avatar` |
| Polish an existing project | `remix_project` with curated `edits` |
| Download an MP4 from a workflow | Use `downloadUrl` on the succeeded workflow run (auto-export is on by default). Call `export_project` only if you set `autoExport: false`. |

When unsure between workflow vs tool, call `get_tools_vs_workflows_guidance`. When unsure **which** workflow (especially script vs storyboard), call `get_workflows_guidance` and **ask the user** with short pros/cons before spending credits.

### Step 4 — Expect async work, and say how long

Workflows, media tools, and exports return ids and progress toward a terminal status (`succeeded`, `failed`, or `cancelled`). Generation is not instant: images are often under a minute, video clips and motion graphics commonly take a few minutes, and full workflows take several. Tell the user that wait up front. On the **hosted** server, long runs may return before completion; continue with `get_workflow_run`, `get_tool_execution`, or `get_project_export`. Details: `get_async_tasks_guidance`.

---

## MCP vs REST SDK

Use **this MCP server** when an agent should call VideoGen tools in-chat (Cursor, Claude, ChatGPT, etc.).

Use the **TypeScript / Python SDK** or REST API directly when building a production backend, webhook receiver, or long-running script outside an MCP host. Same API underneath. Docs: [https://docs.videogen.io](https://docs.videogen.io).

A separate **documentation-only** MCP at `https://docs.videogen.io/_mcp/server` answers questions about the docs. It does not execute API calls. This server does.

---

## ID conventions

All ids are prefixed strings. Store them as-is; do not parse them.

| Prefix | Meaning |
| --- | --- |
| `vg_work_...` | Workflow run |
| `vg_tool_...` | Tool execution |
| `vg_proj_...` | Project |
| `vg_file_...` | Uploaded file |
| `vg_expor_...` / export ids | Project export (use the id returned by `export_project`) |

Numeric timestamps from the API are **seconds** since the Unix epoch (UTC), not milliseconds.

---

## Uploading files (when a tool needs `fileId`)

Many flows need a prior upload (voiceover audio, slideshow PDF, logo, reference images):

- **ChatGPT (hosted)**: prefer `open_uploader` so the user picks a file in-chat.
- **Hosted remote**: `upload_file` with inline base64 for small files, or `create_file_upload` then `PUT` bytes to the returned URL, then `get_file` with `wait: true`.
- **Local stdio**: `upload_file` with a local `filePath`.

Pass the resulting `vg_file_...` into workflow or tool arguments.

---

## Entities (actors, products, visual styles)

Reusable team assets for consistent characters, products, and looks:

1. Upload a reference image (`open_uploader` / `upload_file` / `create_file_upload`).
2. `create_entity` with `entityType` (`ACTOR` | `PRODUCT` | `VISUAL_STYLE`) and `name`.
3. `add_entity_reference` with the image `fileId` and usually `isDefault: true`.
4. Pass the returned `vg_enti_...` as `actorEntityId` on `generate_avatar` / `script_to_video`, or as product/style entity ids on storyboard scenes.

Also: `list_entities`, `get_entity`, `update_entity`, `remove_entity_reference`, `archive_entity`. Prefer MCP entity tools over sending the user to the app unless they ask to manage entities in the UI (`get_app_deep_link` with `NAVIGATE` → `ENTITIES`).

---

<!-- mcp-host-credits-guidance -->
## Credits and product UI

Generation spends team credits. When a tool fails for credits or plan access, be direct: call `get_app_deep_link` with `OPEN_UPGRADE`, `OPEN_PURCHASE_CREDITS`, or `OPEN_ENABLE_TOP_UPS` as appropriate, return that URL, and walk the user into the flow in the VideoGen app. Do not claim MCP can change billing inline.

MCP never exposes `watermarkMode` or `endScreenMode`. Every generation and export uses `AUTO`: Free-plan results include the VideoGen watermark (and a short "Made with VideoGen" end screen on project exports). Removing that branding requires VideoGen Pro. If the user wants watermark-free output, call `get_app_deep_link` with `OPEN_UPGRADE` and walk them into Pro. After they upgrade, keep using MCP as-is; `AUTO` then omits branding. Do not invent those parameters or tell the user to change a workspace watermark setting.
<!-- /mcp-host-credits-guidance -->

---

## Canonical product flow (reminder)

1. Run a workflow (creates a project). Default `autoExport` waits for an MP4.
2. Give the user `downloadUrl` when status is `succeeded`.
3. Optionally set `autoExport: false`, then `remix_project`, then `export_project`, if polish must appear in the MP4.

Full detail: `get_workflows_guidance`.
