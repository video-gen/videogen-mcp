# Workflows: run, remix, export

You are helping a user create a finished VideoGen video through MCP. **Read the Fast Path first.** For async polling details, call `get_async_tasks_guidance`. For when to use a single media tool instead, call `get_tools_vs_workflows_guidance`.

Workflows create an editable **project** and run the full generation pipeline. They are the heart of VideoGen for professional multi-scene video.

---

## Fast Path: run (auto-export) → MP4

Workflow tools default to `autoExport: true`. Wait until status is **`succeeded`**, then give the user **`downloadUrl`**. Do not treat `workflowRunId` as the finished video.

### Step 1 — Choose and start a workflow

**Ask before starting** when the user wants a full video but has not named a workflow (e.g. “make a ~1 minute video about X”). Briefly give pros/cons, then wait for their pick. Do **not** silently default to `storyboard_to_video`.

| Prefer when… | Tool | Core inputs |
| --- | --- | --- |
| Narrated / informational / explainer / news / ads from **text**, especially **~1 minute or longer** | `script_to_video` | `script`, optional `style`, `aspectRatio` |
| An audio voiceover file | `voiceover_to_video` | `fileId` (uploaded audio), optional `style`, `aspectRatio` |
| A PDF or PowerPoint | `slideshow_to_video` | `fileId` (uploaded deck) |
| Short, tightly directed **shot list** (user wants frame-by-frame control) | `storyboard_to_video` | `scenes` (visual prompt + optional spoken words per scene) |
| One short clip idea (up to ~30s) as a project | `prompt_to_video_clip` | `prompt`, optional reference image file ids |

#### Script vs storyboard (credits and length)

| | `script_to_video` | `storyboard_to_video` |
| --- | --- | --- |
| Best for | Longer narrated pieces, explainers, product/marketing talk-tracks, news-style videos | Short, visual-first spots where each shot is specified |
| How it works | You provide the script; VideoGen plans visuals and timing | You provide every scene prompt yourself |
| Credits | Usually far cheaper for multi-minute / multi-topic content | **Much more expensive** per scene (each scene is a heavy generation) |
| Scene limit (agent rule) | No hard scene count from you | **At most 3 scenes** unless the user **explicitly** asks for more |

Hard rules for `storyboard_to_video`:

1. Default to **≤ 3 scenes**. Never invent a 5–10 scene storyboard for a long brief.
2. If the user wants more than 3 storyboard scenes, **confirm first** and warn that credit use scales with scene count.
3. For “about one minute,” “explainer,” “informational,” “news,” or similar without a shot list → prefer **`script_to_video`**, or ask script vs storyboard with the table above.
4. Do not use storyboard as a fallback when another workflow’s optional fields fail validation. Fix the payload or switch intentionally after asking.

Creative MCP fields use `style` (visual look) and `aspectRatio` (`{ width, height }` units, e.g. `{ width: 16, height: 9 }` for 16:9). Write `style` as a full, strict paragraph like the app defaults on the `style` field (medium, texture, palette, then composition). Do not pass a short label such as "watercolor". Image models pack the frame with text, charts, diagrams, and extra objects unless the style forbids that. Every style must keep the picture simple: one uncluttered subject in the middle half of the frame, empty margins, and no on-image text or diagrams unless the user asked for one specific word or number. Omit `style` for the Realistic default (`Photorealistic photograph, natural lighting`).

Upload required files first (`open_uploader`, `upload_file`, or `create_file_upload`). See `get_getting_started_guidance`.

Wait until the workflow run is **`succeeded`**. When `autoExport` is on (the default), the result includes **`downloadUrl`**. Keep **`projectId`** for later remix or a second export.

### Step 2 — Optional remix (before export)

If the user wants captions, transitions, zoom, or Convert images to videos **in the MP4**, set `autoExport: false` on the workflow tool, wait until succeeded, then call `remix_project` **before** `export_project`. Remix after auto-export does not change the already-rendered file.

Call `remix_project` with `projectId` and ordered `edits`:

| Edit | Effect |
| --- | --- |
| `CAPTIONS` | Show / enable captions |
| `TRANSITIONS` | Add section and asset transitions |
| `CONVERT_IMAGES_TO_VIDEOS` | Generate AI video clips from every still (expensive; same as Add Motion). Not zoom. |
| `ZOOM` | Cheap Ken Burns zoom on stills. Use this for light motion. |

Pass `saveAsNewProject: true` to edit a copy and leave the original alone.

Poll `list_project_remix_actions` until remix actions succeed before exporting if those edits must appear in the MP4.

### Step 3 — Export (only if autoExport was false)

If you set `autoExport: false`, call `export_project` with `projectId`. When status is `succeeded`, give the user `downloadUrl` (or keep polling with `get_project_export` on hosted). MCP always exports with `AUTO` branding (a VideoGen watermark and short end screen may appear depending on the account). Do not pass `watermarkMode` or `endScreenMode`.

When `autoExport` stayed true, skip this step: the workflow result already has `downloadUrl`.

---

## About `projectId` and `projectUrl`

- **`projectId`** (`vg_proj_...`): use for every follow-up MCP/API call.
- **`projectUrl`**: human editor link only. Skip it in automated flows.
- **Retries create new projects.** Keep each `workflowRunId`, `projectId`, and
  `projectUrl` together. After a retry, poll the new run, replace the failed
  attempt's ids, and share only the URL for the succeeded retry.

---

## Workflow details

### Script to video (`script_to_video`)

**Default for most full videos from text.** VideoGen uses the script, adds visuals and narration, and builds a project. Prefer this for narrated explainers, product marketing, news/launch summaries, ads, and social posts, especially anything around **one minute or longer**.

Optional actor narration: pass `actorEntityId` (and optional `avatarQuality`) when the user wants an on-screen avatar speaker. Prefer actor entities over legacy avatar presenter ids. Create or look up actors with `create_entity` / `list_entities` (attach a reference image via `add_entity_reference` first).

### Voiceover to video (`voiceover_to_video`)

Upload audio first, then pass `fileId`. VideoGen transcribes and matches visuals to the narration.

### Slideshow to video (`slideshow_to_video`)

Upload a PDF or PowerPoint, then pass `fileId`. Builds a narrated walkthrough of the slides.

### Storyboard to video (`storyboard_to_video`)

Pass ordered `scenes`. Each scene needs a visual prompt; spoken words are optional. Use only when the user wants **frame-by-frame** control of what appears on screen (or explicitly asks for storyboard).

**Credit cost scales with scene count.** Keep storyboards to **3 scenes or fewer** unless the user specifically requests more. For longer informational scripts, use `script_to_video` instead of expanding a storyboard.

### Prompt to video clip (`prompt_to_video_clip`)

One short AI clip inside an editable project (duration up to about 30 seconds; clamped to the selected quality's supported range). For a **standalone** clip with no project pipeline, prefer the media tool `generate_video_clip` instead (see tools-vs-workflows guidance).

---

## Remix notes

MCP `remix_project` exposes a curated subset of remix actions as `edits`. The full REST API supports more action types (music file, logo file, translate, upscale, and others) via `POST /v1/projects/{projectId}/remix`. If the user needs an edit that is not `CAPTIONS` / `TRANSITIONS` / `CONVERT_IMAGES_TO_VIDEOS` / `ZOOM`, say so and point them at the REST/SDK remix API or the VideoGen editor (`projectUrl` / `get_app_deep_link`).

When starting a workflow through the REST SDK, callers pass `remixActions` and `autoExport: true` in the same request so polish runs before the MP4. MCP workflow tools default `autoExport` on without inline remix; apply polish with `remix_project` only after setting `autoExport: false` on the workflow start.

Recommended cheap polish: `CAPTIONS` + `ZOOM` (or `TRANSITIONS` + `ZOOM`). Only add `CONVERT_IMAGES_TO_VIDEOS` when the user explicitly asked to turn stills into generated video clips. Do not treat “animate,” “motion,” or “zoom” as that edit.

---

## Listing and cancelling

- `list_workflow_runs`: recent runs
- `get_workflow_run`: status / progress / project ids / `downloadUrl` when auto-export finished
- `cancel_workflow_run`: best-effort cancel
- `list_projects` / `get_project`: project metadata and share URL

---

## Common mistakes

1. **Skipping the MP4.** A succeeded workflow with default `autoExport` includes `downloadUrl`. Give that URL to the user. Only skip auto-export when you need `remix_project` first, then call `export_project`.
2. **Remix or export before workflow `succeeded`.**
3. **Using a media tool when the user asked for a full video.** Prefer a workflow.
4. **Forgetting uploads** before voiceover / slideshow / logo-related flows.
5. **Defaulting to a long `storyboard_to_video`** for a ~1 minute explainer. Prefer `script_to_video`, or ask the user with pros/cons first. Never start storyboard with more than 3 scenes unless they explicitly asked.
