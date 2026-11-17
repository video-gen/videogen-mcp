# Workflows: run, edit, export

You are helping a user create a finished VideoGen video through MCP. **Read the Fast Path first.** For async polling details, call `get_async_tasks_guidance`. For when to use a single media tool instead, call `get_tools_vs_workflows_guidance`.

Workflows create an editable **project** and run the full generation pipeline. They are the heart of VideoGen for professional multi-scene video.

---

## Fast Path: run (auto-export) → MP4

Workflow tools default to `autoExport: true`. Wait until status is **`succeeded`**, then give the user **`downloadUrl`**. Do not treat `workflowRunId` as the finished video.

### Step 1 — Choose and start a workflow

**Ask before starting** when the user wants a full video but has not named a workflow (e.g. “make a ~1 minute video about X”). Briefly give pros/cons, then wait for their pick. Do **not** silently default to `storyboard_to_video`.

| Prefer when…                                                                                        | Tool                   | Core inputs                                                          |
| --------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| Narrated / informational / explainer / news / ads from **text**, especially **~1 minute or longer** | `script_to_video`      | `script`, optional `style`, `aspectRatio`                            |
| An audio voiceover file                                                                             | `voiceover_to_video`   | `fileId` (uploaded audio), optional `style`, `aspectRatio`           |
| A PDF or PowerPoint                                                                                 | `slideshow_to_video`   | `fileId` (uploaded deck)                                             |
| Short, tightly directed **shot list** (user wants frame-by-frame control)                           | `storyboard_to_video`  | `scenes` (visual prompt + optional spoken words per scene)           |
| One short clip idea (up to ~30s) as a project                                                       | `prompt_to_video_clip` | `prompt`, optional reference image file ids                          |
| Restyle an **existing video** (a new look, same timing)                                             | `video_to_video`       | `videoFileId` (uploaded video) or `videoUrl` (public link), `prompt` |
| Translate an **existing video's speech** into other languages                                       | `translate_video`      | `videoFileId` (uploaded video), `outputLanguages`                    |

#### Script vs storyboard (credits and length)

|                          | `script_to_video`                                                                    | `storyboard_to_video`                                                |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Best for                 | Longer narrated pieces, explainers, product/marketing talk-tracks, news-style videos | Short, visual-first spots where each shot is specified               |
| How it works             | You provide the script; VideoGen plans visuals and timing                            | You provide every scene prompt yourself                              |
| Credits                  | Usually far cheaper for multi-minute / multi-topic content                           | **Much more expensive** per scene (each scene is a heavy generation) |
| Scene limit (agent rule) | No hard scene count from you                                                         | **At most 3 scenes** unless the user **explicitly** asks for more    |

Hard rules for `storyboard_to_video`:

1. Default to **≤ 3 scenes**. Never invent a 5–10 scene storyboard for a long brief.
2. If the user wants more than 3 storyboard scenes, **confirm first** and warn that credit use scales with scene count.
3. For “about one minute,” “explainer,” “informational,” “news,” or similar without a shot list → prefer **`script_to_video`**, or ask script vs storyboard with the table above.
4. Do not use storyboard as a fallback when another workflow’s optional fields fail validation. Fix the payload or switch intentionally after asking.

Creative MCP fields use `style` (visual look) and `aspectRatio` (`{ width, height }` units, e.g. `{ width: 16, height: 9 }` for 16:9). Copy `style` from the default table below. Do not invent a shorter version.

<!-- mcp-ai-style-examples -->
<!-- /mcp-ai-style-examples -->

Upload required files first. On ChatGPT, call `open_uploader` and pass any files already attached in the chat. A filename is not an upload. Other clients use `upload_file` or `create_file_upload`. See `get_getting_started_guidance`.

Wait until the workflow run is **`succeeded`**. When `autoExport` is on (the default), the result includes **`downloadUrl`**. Keep **`projectId`** for later edit or a second export.

### Step 2 — Optional edit (before export)

If the user wants captions, transitions, zoom, or Convert images to videos **in the MP4**, set `autoExport: false` on the workflow tool, wait until succeeded, then call `start_video_edits` **before** `export_project`. Edit after auto-export does not change the already-rendered file.

Call `start_video_edits` with `projectId`, the output's `editableVideoId`, and ordered `videoEdits`:

| Edit                       | Effect                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `ENABLE_CAPTIONS`          | Show / enable captions                                                              |
| `ADD_TRANSITIONS`          | Add section and asset transitions                                                   |
| `CONVERT_IMAGES_TO_VIDEOS` | Generate AI video clips from every still (expensive; same as Add Motion). Not zoom. |
| `ADD_ZOOM`                 | Cheap Ken Burns zoom on stills. Use this for light motion.                          |

Pass `saveAsNewProject: true` to edit a copy and leave the original alone.

Poll `list_video_edits` until video edits succeed before exporting if those edits must appear in the MP4.

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

To show a saved product, actor, or visual style, pass that entity's `vg_enti_...` id on every scene that should use its reference images: `productEntityIds`, `actorEntityIds`, or `visualStyleEntityId`. Also pass request-level `productEntityIds` or `actorEntityIds` so the entity stays on the project. Create the entity and call `add_entity_reference` first. A prompt by itself leaves the reference images off the shot.

**Credit cost scales with scene count.** Keep storyboards to **3 scenes or fewer** unless the user specifically requests more. For longer informational scripts, use `script_to_video` instead of expanding a storyboard.

### Prompt to video clip (`prompt_to_video_clip`)

One short AI clip inside an editable project (duration up to about 30 seconds; clamped to the selected quality's supported range). For a **standalone** clip with no project pipeline, prefer the media tool `generate_video_clip` instead (see tools-vs-workflows guidance).

### Video to video (`video_to_video`)

Restyles an existing video from one `prompt` (for example "hand-made claymation with soft studio lighting") and keeps its length, timing, and cuts. Pass exactly one source: `videoFileId` for an imported/uploaded video, or `videoUrl` for a public link. For external links, prefer `import_video_from_url` first and poll `get_video_url_import` before starting generation. If the result contains `selection`, ask the user which listed video they want, then import the same sourceUrl with that videoIndex. Use the succeeded import's fileId as `videoFileId`. This avoids starting a generation workflow before resolving an ambiguous or unavailable source. Direct `videoUrl` remains supported, but a multi-video source requires a choice. Private, login-only, and DRM-protected links cannot be imported.

Up to 120 seconds is restyled per run. Without `trimStartSeconds` / `trimEndSeconds`, the first 120 seconds is used. The output always preserves the source aspect ratio, including custom ratios, for uploads and public links. There is no aspect ratio option. `audio: "KEEP_ORIGINAL"` (the default) keeps the source soundtrack. `quality` accepts `LOW`, `STANDARD`, `HIGH` (the default), or `MAX`. Credit use grows with the restyled length and with higher quality tiers.

### Translate video (`translate_video`)

Translates the speech of an uploaded video (`videoFileId`) into each language in `outputLanguages` (BCP-47 codes, up to 10), keeping the original voices and timing. Source videos can be up to 8 minutes. Pass `sourceLanguage` only when the spoken language is known; otherwise it is detected.

One run creates one project with one editable video per language. Languages run in parallel and a failed language does not fail the others; the run fails only when every language fails. After it succeeds, `get_workflow_run` returns `outputs`, one entry per language with `language`, `status`, and `editableVideoId` (null when that language failed). Auto-export renders only the first successful language. For the others, call `export_project` with the project id and that language's `editableVideoId`. `start_video_edits` also accepts `editableVideoId` to edit one language. There is no aspect ratio or transitions option. Credit use grows with video length and the number of languages.

For a single translated video file without a project, use the media tool `dub_video`.

---

## Edit notes

MCP `start_video_edits` takes `projectId`, the intended `editableVideoId`, and ordered `videoEdits` objects from the shared API operation schema. It supports captions, transitions, image animation, zoom, music, logos, translation, upscale, and the other listed operations. Poll `list_video_edits` for the returned `videoEditIds` before exporting the same video.

When starting a workflow through the REST SDK, callers pass `videoEdits` and `autoExport: true` in the same request so polish runs before the MP4. MCP workflow tools accept the same `videoEdits` objects and default `autoExport` on. To edit after inspecting a workflow result, start it with `autoExport: false`, apply `start_video_edits` to the intended output video, and export after those edits succeed.

Recommended cheap polish: `ENABLE_CAPTIONS` + `ADD_ZOOM` (or `ADD_TRANSITIONS` + `ADD_ZOOM`). Only add `CONVERT_IMAGES_TO_VIDEOS` when the user explicitly asked to turn stills into generated video clips. Do not treat “animate,” “motion,” or “zoom” as that edit.

---

## Listing and cancelling

- `list_workflow_runs`: recent runs
- `get_workflow_run`: status / progress / project ids / `downloadUrl` when auto-export finished
- `cancel_workflow_run`: best-effort cancel
- `list_projects` / `get_project`: project metadata and share URL

---

## Common mistakes

1. **Skipping the MP4.** A succeeded workflow with default `autoExport` includes `downloadUrl`. Give that URL to the user. Only skip auto-export when you need `start_video_edits` first, then call `export_project`.
2. **Edit or export before workflow `succeeded`.**
3. **Using a media tool when the user asked for a full video.** Prefer a workflow.
4. **Forgetting uploads** before voiceover / slideshow / translate / logo-related flows. (`video_to_video` takes a public `videoUrl` directly.)
5. **Defaulting to a long `storyboard_to_video`** for a ~1 minute explainer. Prefer `script_to_video`, or ask the user with pros/cons first. Never start storyboard with more than 3 scenes unless they explicitly asked.
