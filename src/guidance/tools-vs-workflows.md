# Tools vs workflows

You are choosing between VideoGen **workflows** and **standalone media tools**. **Read the Fast Path first.**

The single most important idea: **workflows build a full editable video project; tools generate one asset (or transform one asset) with automatic model routing.** Do not start a long workflow when the user only needs a single image or clip, and do not stitch many one-off tools when they asked for a finished narrated video.

---

## Fast Path: which surface?

Ask what “done” looks like for the user.

### Use a workflow when

- They want a **multi-scene, narrated, professionally assembled video**
- They need an **editable project** they can remix and export to MP4
- Input is a **script**, **voiceover file**, **slideshow**, **storyboard**, or **short prompt-as-project clip**

Call the matching workflow tool (`script_to_video`, `voiceover_to_video`, `slideshow_to_video`, `storyboard_to_video`, `prompt_to_video_clip`). Then remix and export. Details: `get_workflows_guidance`.

**Which workflow?** For ~1 minute+ narrated / informational / news-style videos from text, prefer **`script_to_video`**. Use **`storyboard_to_video`** only for short, shot-directed spots, and **never more than 3 scenes** unless the user explicitly asks for more (storyboard is much more credit-heavy per scene). If the user has not named a workflow, **ask** with a short pros/cons (script vs storyboard) before starting.

### Use a media tool when

- They want **one** image, video clip, voiceover, sound effect, music bed, or avatar take
- They want a **transform**: upscale, remove background, vectorize, 3D effect
- They will **assemble elsewhere** or only need the asset file id / download URL

Call tools such as `generate_image`, `generate_video_clip`, `text_to_speech`, `generate_sound_effect`, `generate_music`, `generate_avatar`, `generate_motion_graphic`, `vectorize_image`, `remove_image_background`, `remove_video_background`, `upscale_image`, `upscale_video`, `image_3d_effect`.

### Borderline: short clip

| Intent | Prefer |
| --- | --- |
| Standalone short clip, no editor project | `generate_video_clip` |
| Short clip that should live in a VideoGen project (remix/export later) | `prompt_to_video_clip` |

Both routes automatically pick a suitable generation model for the inputs and settings. **You do not choose an upstream model name.** Describe the creative intent (`prompt`, `style`, quality, duration) and let VideoGen route.

---

## What “model router” means here

Standalone generative tools (especially `generate_video_clip` and image generation) send each request through VideoGen’s routing so quality, latency, and capability match the request. Agents should **not** ask the user which third-party model to use, and should **not** invent provider names.

Workflows go further: they orchestrate script/timing, visuals, narration, captions, and project structure into one pipeline. That is why workflows are the default for “make me a real video.”

---

## Tools catalog (MCP)

### Generate

- `generate_image` — still images from text (and related image flows per tool schema)
- `generate_video_clip` — short standalone video clip (up to about 30 seconds)
- `text_to_speech` — voiceover audio from text
- `generate_sound_effect` — SFX from a text description
- `generate_music` — music bed
- `generate_avatar` — talking-head / avatar clip from audio + actor source
- `generate_motion_graphic` — motion graphic generation when exposed by the tool schema. Typically 2–5 minutes (code + render); tell the user that wait before starting.

### Transform

- `vectorize_image`, `remove_image_background`, `remove_video_background`
- `upscale_image`, `upscale_video`, `image_3d_effect`

### Run lifecycle

- `list_tool_executions`, `get_tool_execution`, `cancel_tool_execution`

Async behavior matches workflows: start returns an id; poll on hosted with `get_tool_execution`. See `get_async_tasks_guidance`.

---

## Workflows catalog (MCP)

- `script_to_video`, `voiceover_to_video`, `slideshow_to_video`, `storyboard_to_video`, `prompt_to_video_clip`
- `list_workflow_runs`, `get_workflow_run`, `cancel_workflow_run`
- Then `remix_project` / `export_project` on the resulting `projectId`

---

## Decision examples

| User says | Do this |
| --- | --- |
| “Make a 60s explainer from this script” | `script_to_video` → optional remix → `export_project` |
| “Make a ~1 minute 16:9 video about a product launch” (no workflow named) | Ask script vs storyboard (pros/cons); default recommendation **`script_to_video`** |
| “Storyboard three hero shots of the bottle” | `storyboard_to_video` with ≤ 3 scenes |
| “Generate a hero image of a blue bottle” | `generate_image` |
| “Turn this MP3 into a video with b-roll” | upload → `voiceover_to_video` → export |
| “One 8-second product teaser, just the clip file” | `generate_video_clip` |
| “Add captions and animate the stills on my project” | `remix_project` with `CAPTIONS` and `ANIMATE_IMAGES` |
| “Remove the background from this PNG” | upload → `remove_image_background` |

---

## Common mistakes

1. **Chaining five media tools** to fake a full video when `script_to_video` exists.
2. **Starting `script_to_video`** when the user only asked for a stock-style still or one SFX.
3. **Naming internal AI vendors** to the user. Stay on VideoGen concepts: tools, workflows, quality, style.
4. **Forgetting that workflow output is a project**, not the final MP4, until `export_project` succeeds.
5. **Running a long `storyboard_to_video`** (many scenes) for an informational / ~1 minute brief. Prefer `script_to_video`, or ask first; cap storyboard at 3 scenes unless the user insists.
