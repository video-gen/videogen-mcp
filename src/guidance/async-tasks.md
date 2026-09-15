# Handling async tasks (MCP)

You are helping a user wait for VideoGen work that does not finish in one tool call. **Read the Fast Path first.**

Workflows, standalone media tools, and project exports are asynchronous. Start tools return quickly with an id; completion is a later poll (or a webhook on a backend that uses the REST API).

---

## Fast Path: get a terminal result

### Step 1 — Start the operation

| Work | Start tool | Id to keep |
| --- | --- | --- |
| End-to-end video | `script_to_video`, `voiceover_to_video`, `slideshow_to_video`, `storyboard_to_video`, `prompt_to_video_clip` | `workflowRunId` (and `projectId` when present) |
| Single media asset | `generate_image`, `generate_video_clip`, `text_to_speech`, … | `toolExecutionId` |
| MP4 render | `export_project` | `exportId` (+ `projectId`) |

### Step 2 — Know the status set

Shared statuses: `pending`, `running`, `succeeded`, `failed`, `cancelled`.

`succeeded`, `failed`, and `cancelled` are **terminal**. Stop polling once you see one.

### Step 3 — Set an honest time expectation

Tell the user a realistic wait **before or as you start**. Do not imply the result will appear in a few seconds. A healthy `pending` / `running` job is expected, not a stall.

| Work | Typical wall time |
| --- | --- |
| `generate_image` and other still-image tools | about 15–60 seconds |
| `generate_video_clip` | about 1–3 minutes (HIGH/MAX can be longer) |
| `generate_motion_graphic` | about 2–5 minutes (writes animation code, then renders; complex prompts can take longer) |
| `generate_avatar`, `generate_music` | often a few minutes |
| Full workflows (`script_to_video`, …) with default auto-export | several minutes for the video, then more for the MP4 |

Keep polling calmly. Quote `progressPercentage` when present. Do not start a second generation just because the first one is still running.

### Step 4 — Hosted vs local wait behavior

Composite start tools may poll internally for a while.

- **Local (stdio)**: the server can wait longer (on the order of minutes) for completion before returning.
- **Hosted (Streamable HTTP)**: wait is capped under the proxy timeout (~90 seconds). If work is still `pending` / `running`, the tool returns a **snapshot** with the id. That is not a failure.

When the snapshot is non-terminal, continue with the matching get tool:

| Work | Continue polling with |
| --- | --- |
| Workflow | `get_workflow_run` (`workflowRunId`) |
| Media tool | `get_tool_execution` (`toolExecutionId`) |
| Export | `get_project_export` (`projectId`, `exportId`) |
| Remix actions | `list_project_remix_actions` (`projectId`) |

Tell the user progress from `progressPercentage` when present. Retry get tools every few seconds until terminal (or until the user cancels).

### Step 5 — Cancel when asked

- Workflow: `cancel_workflow_run`
- Tool: `cancel_tool_execution`

Cancellation is best-effort; confirm with a final get/list call.

---

## Workflow runs

After a workflow start succeeds, store:

- **`workflowRunId`**: poll with `get_workflow_run`.
- **`projectId`**: required for `remix_project`, `export_project`, and other project tools. Prefer this over `projectUrl` for API/MCP automation.
- **`projectUrl`**: deep link for a human to open the editor. Safe to share while a run is still processing.

Treat those three values as one run-specific tuple. Every workflow start call
creates a new project. If a run fails and you retry:

1. Discard the failed run's `workflowRunId`, `projectId`, and `projectUrl` from
   the active result.
2. Store the retry's run, project id, and project URL.
3. Poll only the retry's `workflowRunId`.
4. Share only the `projectUrl` paired with the run that reaches `succeeded`.

Never combine a retry's status or progress with an earlier attempt's project
link. A failed attempt may leave an editable but ungenerated project behind;
do not present that project as the completed result.

List recent runs with `list_workflow_runs` when the user asks what is in flight or recent.

---

## Tool executions

Media tools return `toolExecutionId`. Poll with `get_tool_execution` until terminal. List with `list_tool_executions` when needed.

On success, results usually include file ids and download/thumbnail URLs for the generated asset.

---

## Project exports

`export_project` starts an MP4 render. When status is `succeeded`, use `downloadUrl` (time-limited). If the start response is still running on hosted MCP, poll `get_project_export`.

Do not treat a missing `downloadUrl` while status is `running` as an error.

---

## Remix actions

`remix_project` returns remix action ids. Each action has its own status. Poll `list_project_remix_actions` until every relevant action is terminal before exporting, if the user wants those edits in the MP4.

---

## Webhooks (outside MCP)

This MCP server does **not** register webhook endpoints. For production backends that should not hold a poll loop, use the REST API webhook subscription (`workflow_run.*`, tool execution events, etc.). See [https://docs.videogen.io/handling-async-tasks/webhooks](https://docs.videogen.io/handling-async-tasks/webhooks).

Inside MCP chats, prefer polling with the get_* tools above.

---

## Common mistakes

1. **Treating a hosted mid-run snapshot as failure.** Continue with `get_*`.
2. **Exporting before the workflow (or remix) is `succeeded`.** Wait for terminal success first.
3. **Using `projectUrl` instead of `projectId` for follow-up tools.** Always pass `projectId`.
4. **Reusing a failed attempt's project link after retrying.** Every retry creates a new project; replace the entire workflow/project tuple and share only the succeeded attempt's `projectUrl`.
5. **Starting a second long workflow without checking credit/auth errors** from the first. Surface failures clearly; do not silently retry forever.
