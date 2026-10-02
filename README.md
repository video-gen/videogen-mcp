# @videogen/mcp

[![AllMCPs Verified](https://allmcps.com/api/badge/videogen-mcp)](https://allmcps.com/mcp/videogen-mcp?verify=39b87ccf-9cad-4bc2-b534-ee7e1218bc82)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes the full [VideoGen API](https://docs.videogen.io) to any MCP client (Cursor, Claude Desktop, Windsurf, etc.). Your agent can generate videos from scripts, produce images / voiceovers / music / avatars, upload files, export and remix projects, and manage runs — all authenticated with your own API key.

Learn more about the [VideoGen MCP server](https://videogen.io/videogen-mcp).

Find the hosted server on [Smithery](https://smithery.ai/servers/videogen/videogen).

It ships in two transports. Tool surface is the same except for ChatGPT Apps commerce policy (see below):

- **Local (stdio)** — the client launches `@videogen/mcp` as a subprocess and reads the key from `VIDEOGEN_API_KEY`.
- **Remote (Streamable HTTP)** — a hosted, multi-tenant HTTP server. Clients connect over the network and authenticate per request with `Authorization: Bearer <api-key>`; no key lives on the server.

**Host surfaces (remote):** `/mcp` (and stdio) is the **STANDARD** surface: when the user is out of credits or needs a plan feature, tools and guidance walk them into `get_app_deep_link` (`OPEN_UPGRADE` / `OPEN_PURCHASE_CREDITS` / `OPEN_ENABLE_TOP_UPS`). `/mcp/chatgpt` is the **ChatGPT Apps** surface: those commerce deep links are omitted, billing errors are rewritten to “manage your VideoGen account,” and copy never says purchase / buy / upgrade / top-ups (OpenAI Plugins digital-goods policy). See `.cursor/rules/chatgpt-mcp-no-commerce.mdc` and `mcp/src/hostSurface.ts`.

This is distinct from the hosted **documentation** MCP at `https://docs.videogen.io/_mcp/server`, which only lets clients read the API docs. This server actually _executes_ the API.

## How it works

- Wraps the official [`@videogen/sdk`](https://www.npmjs.com/package/@videogen/sdk) and calls the live API through the SDK's authenticated passthrough.
- The local transport reads your key from `VIDEOGEN_API_KEY`; the remote transport reads it from each request's `Authorization: Bearer` header and builds a fresh, per-request server bound to that team (stateless — no session state is shared between requests).
- The key never leaves your machine except in requests to the VideoGen API (local), or is forwarded only to the VideoGen API for the duration of the request and never persisted (remote).
- Long-running operations (workflows, media tools, project exports) use **composite tools**. The hosted HTTP transport returns the run/execution id immediately; use the corresponding `get_*` tool to continue polling. The local stdio transport waits for completion by default.

## Configuration

Get an API key from [app.videogen.io/api](https://app.videogen.io/api). Both transports expose the same tools; the remote server is recommended.

### Remote (Streamable HTTP) — recommended

Nothing to install or update. Point any MCP client that supports the Streamable HTTP transport at the hosted endpoint and send your API key as a bearer token:

```json
{
  "mcpServers": {
    "videogen": {
      "url": "https://mcp.videogen.io/mcp",
      "headers": {
        "Authorization": "Bearer sk_videogen_live_..."
      }
    }
  }
}
```

The remote server:

- Accepts MCP JSON-RPC messages via `POST /mcp` (stateless — a fresh server per request).
- Reads the API key or OAuth access token from the `Authorization: Bearer` header. The standard `/mcp` endpoint requires credentials for every request and returns `401` with a `WWW-Authenticate` challenge to start OAuth. The ChatGPT-specific `/mcp/chatgpt` endpoint serves tool discovery unauthenticated and returns its OAuth challenge on a protected tool result because ChatGPT does not start OAuth from the standard transport challenge. The credential is forwarded only to the VideoGen API and never stored.
- Exposes `GET /health` for load-balancer / Cloud Run startup probes.
- Handles CORS preflight (`OPTIONS`) so browser-based clients can connect.
- Supports three upload paths. For small assets (images, logos, short audio), `upload_file` takes base64-encoded contents inline (`fileData`). For large files, `create_file_upload` returns `{ fileId, uploadUrl }`; the client `PUT`s the raw bytes to that short-lived pre-signed URL (no `Authorization` header) and then calls `get_file` with `{ fileId, wait: true }` to wait for processing. In **ChatGPT** (an MCP Apps host), `open_uploader` renders an in-chat upload widget so the user can pick a file directly: the widget itself calls `create_file_upload`, `PUT`s the bytes client-side, and reports back only the resulting `vg_file_...` id, so the pre-signed URL is never surfaced to the model. Either way you get a `vg_file_...` id to pass to other tools. The local (stdio) server instead uploads by local `filePath`. (The server never fetches a caller-supplied URL, so there is no SSRF surface.)

### Local (stdio) — Cursor / Claude Desktop

Runs as a subprocess launched by your client with `npx`. Reads the API key from the `VIDEOGEN_API_KEY` environment variable, which never leaves your machine except in requests to the VideoGen API:

```json
{
  "mcpServers": {
    "videogen": {
      "command": "npx",
      "args": ["-y", "@videogen/mcp"],
      "env": {
        "VIDEOGEN_API_KEY": "sk_videogen_live_..."
      }
    }
  }
}
```

### Environment variables

| Variable            | Required   | Default                   | Description                                                                                          |
| ------------------- | ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `VIDEOGEN_API_KEY`  | local only | —                         | Your VideoGen API key (local server). On the remote server the key travels in the `Authorization` header instead. |
| `VIDEOGEN_BASE_URL` | no         | `https://api.videogen.io` | Override the upstream API base URL (e.g. for local development). Applies to both transports. When unset, the remote server resolves the upstream API per deployment environment (dev/prerelease/prod); local runs default to the public prod API. |
| `VIDEOGEN_OAUTH_ISSUER` | no     | —                         | Remote server only. Full OAuth 2.1 issuer URL. When set (or derived from the var below), the server advertises OAuth protected-resource metadata (RFC 9728) and a `resource_metadata` 401 challenge so MCP clients can discover the authorization server and run account linking. Must match the issuer that the upstream API (`VIDEOGEN_BASE_URL`) validates tokens against. |
| `VIDEOGEN_OAUTH_SUPABASE_PROJECT_URL` | no | —             | Remote server only. Supabase project base URL; the issuer is derived as `${url}/auth/v1`. Ignored when `VIDEOGEN_OAUTH_ISSUER` is set. |
| `VIDEOGEN_OPENAI_APPS_CHALLENGE_TOKEN` | no | —            | Remote server only. Public OpenAI Plugins / ChatGPT Apps domain-verification token. When set, `GET /.well-known/openai-apps-challenge` returns that exact value as `text/plain`. When unset, that path is a non-JSON-RPC 404. |

## Tools

See the [callable tool reference](./TOOL_SCHEMAS.md) and [complete input/output JSON schemas](./tool-schemas.json) for 50 live hosted tools. The schema snapshot is captured from MCP `tools/list`; use discovery on your connected server for the latest definitions.

### Workflows (end-to-end video)

`script_to_video`, `voiceover_to_video`, `slideshow_to_video`, `storyboard_to_video`, `list_workflow_runs`, `get_workflow_run`, `cancel_workflow_run`

### Media tools

`generate_image`, `generate_video_clip`, `text_to_speech`, `generate_sound_effect`, `generate_music`, `generate_avatar`, `vectorize_image`, `remove_image_background`, `remove_video_background`, `upscale_image`, `upscale_video`, `image_3d_effect`, `list_tool_executions`, `get_tool_execution`, `cancel_tool_execution`

### Projects

`list_projects`, `get_project`, `export_project`, `get_project_export`, `remix_project`, `list_project_remix_actions`

### Files

`upload_file`, `create_file_upload`, `get_file`, `list_files`, `open_uploader`

`open_uploader` is a **ChatGPT App** widget (remote server only): it renders an in-chat file picker (a React component served as an MCP UI resource) so a ChatGPT user can attach a file without pasting a link. It is a no-op on clients that don't render MCP Apps UI — those use `upload_file` / `create_file_upload` instead.

### Entities

`list_entities`, `create_entity`, `get_entity`, `update_entity`, `archive_entity`, `add_entity_reference`, `remove_entity_reference`

Create ACTOR / PRODUCT / VISUAL_STYLE entities, attach uploaded image references, then pass `vg_enti_...` ids into workflows and `generate_avatar` (`actorEntityId`, storyboard entity attachments, etc.).

### Resources & account

`list_tts_voices`, `list_languages`, `get_me`, `get_app_deep_link`

### Guidance (docs for agents)

Operational manuals exposed as MCP resources and mirror tools (no API credential required):

| Resource URI | Mirror tool |
| --- | --- |
| `guidance://getting-started` | `get_getting_started_guidance` |
| `guidance://async-tasks` | `get_async_tasks_guidance` |
| `guidance://workflows` | `get_workflows_guidance` |
| `guidance://tools-vs-workflows` | `get_tools_vs_workflows_guidance` |

Call the matching `get_*_guidance` tool before non-trivial setup, polling, workflow/remix/export, or tools-vs-workflows decisions. Many hosts never auto-attach resources; the tools are the reliable path. Content is grounded in the public docs at [docs.videogen.io](https://docs.videogen.io) but written for MCP tool usage (including hosted wait caps).

Creative MCP tools expose user intent rather than the lower-level developer API request shape. Use `style` for a full, strict visual-style paragraph (medium, texture, palette, then a simple composition lock) and `aspectRatio` (`{ width, height }` units, e.g. `{ width: 16, height: 9 }`) for output dimensions. Omitted workflow styles use the app Realistic look (`Photorealistic photograph, natural lighting`). Do not pass a short label such as `watercolor`. Image models pack the frame with text, charts, and diagrams unless the style keeps the picture simple. `remix_project` accepts curated `edits`: `CAPTIONS`, `TRANSITIONS`, `CONVERT_IMAGES_TO_VIDEOS`, and `ZOOM`. `CONVERT_IMAGES_TO_VIDEOS` generates AI video clips from stills (expensive). `ZOOM` is cheap Ken Burns camera motion. `watermarkMode` and `endScreenMode` are not exposed; MCP always sends `AUTO` (Free-plan output includes the VideoGen watermark; VideoGen Pro removes it).

Workflow, media-generation, and export tools start the operation and poll internally. On the **hosted** (Streamable HTTP) server, the wait window is capped under Cloudflare's proxy timeout, so long generations return a still-running snapshot instead of a 524. Use `get_tool_execution`, `get_workflow_run`, or `get_project_export` to continue polling.

For `generate_avatar`, provide `audioFileId` and an ACTOR entity via `actorEntityId`. You may set `avatarQuality` to `LOW`, `STANDARD`, `HIGH`, or `MAX`. `script_to_video`, `slideshow_to_video`, and `CHANGE_NARRATOR` accept the same optional actor fields.

See the [full tool reference](https://docs.videogen.io/libraries/mcp) for every tool's parameters and its REST-endpoint mapping.

## Development

```bash
pnpm build           # bundle to dist/ (dist/index.js, dist/http.js, and the widget)
pnpm typecheck       # type-check
pnpm lint:fix        # lint

# Smoke test the local (stdio) server:
VIDEOGEN_API_KEY=sk_videogen_live_... node dist/index.js

# Smoke test the remote (HTTP) server:
PORT=8080 node dist/http.js
#   Health:  curl http://localhost:8080/health
#   MCP:     curl -X POST http://localhost:8080/mcp \
#              -H 'Authorization: Bearer sk_videogen_live_...' \
#              -H 'Content-Type: application/json' \
#              -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`VIDEOGEN_BASE_URL` overrides the upstream API for both transports (e.g. point at a local API during development).

## Deployment (remote server)

The remote server deploys to **Cloud Run** through the standard monorepo CI/CD, alongside `api` / `backend` / `external` / `frontend`:

- **Image:** `ci-cd/docker/mcp/Dockerfile` — a minimal multi-stage Node build (no ffmpeg / gcloud / VPC tooling; the server only makes outbound HTTPS calls to its per-environment VideoGen developer API — `dev.api.videogen.io` / `prerelease.api.videogen.io` / `api.videogen.io`, all of which exist).
- **Service registry:** `mcp` is registered in `ci-cd/utils.ts` (`CLOUD_RUN_SERVICES`).
- **Build config:** `ci-cd/config.build.ts` (`CLOUD_RUN_SERVICE_TO_BUILD_CONFIG_MAP.mcp`).
- **Deploy config:** `ci-cd/config.deploy.ts` (`mcp`) — 1 CPU / 2 GiB, concurrency 80, `60m` request timeout (tool calls long-poll workflows/exports), `allowUnauthenticated: true` (auth is per-request via the caller's API key, not GCP IAM).
- **Generated pipelines:** `ci-cd/cloudbuild/mcp.build.yaml` and the `mcp` entries in the GitHub build/deploy workflow matrices are produced by the CI/CD generators — regenerate them (do not hand-edit) after changing the build/deploy config.

### Manual GCP steps (one-time)

CI/CD builds and deploys the Cloud Run service, but a couple of steps must be done by hand in GCP the first time:

1. **Custom domain / DNS.** The service is reachable at its generated `*.run.app` URL immediately. To serve it at `mcp.videogen.io`, create a Cloud Run **domain mapping** (or add it behind the existing load balancer) and add the corresponding DNS record. Update the `url` in the client config above once the domain resolves.
2. **Verify the first deploy.** After the first successful deploy, confirm `GET https://<service-url>/health` returns `200` and that a `POST /mcp` with a valid bearer token lists tools.

### ChatGPT connector (OAuth) checklist

After deploying the remote MCP server for an environment (e.g. DEV → `https://dev.mcp.videogen.io/mcp`):

1. Confirm discovery + auth modes:
   - `GET https://<mcp-host>/.well-known/oauth-protected-resource/mcp` returns `200` with `resource` ending in `/mcp` and `authorization_servers` equal to the MCP origin (pathless — Cursor workaround).
   - `GET https://<mcp-host>/.well-known/oauth-protected-resource/mcp/chatgpt` returns `200` with `resource` ending in `/mcp/chatgpt` and `authorization_servers` equal to the Supabase Auth issuer (`…/auth/v1`).
   - `GET https://<mcp-host>/.well-known/oauth-authorization-server` returns `200` with `issuer` equal to the MCP origin and authorize/token/register endpoints on Supabase Auth.
   - `npx -y @modelcontextprotocol/inspector@1.0.0 --cli https://<mcp-host>/mcp/chatgpt --transport http --method tools/list` lists ~35+ tools (including `open_uploader` as `noauth` and API tools as `oauth2`).
   - Every anonymous POST against `/mcp`, including `initialize` and `tools/list`, returns HTTP **401** + `WWW-Authenticate` so Cursor / Claude start OAuth immediately.
   - Anonymous `tools/call get_me` against `/mcp/chatgpt` returns HTTP **200** with a tool-result `_meta["mcp/www_authenticate"]` challenge (ChatGPT).
2. In the ChatGPT app (e.g. **VideoGen (DEV)**), set the MCP URL to `https://<mcp-host>/mcp/chatgpt` (not `/mcp`). Copy the exact OAuth callback URL (`https://chatgpt.com/connector/oauth/{callback_id}`) into that environment's Supabase Auth OAuth client redirect allowlist.
3. Prefer **DCR** in the ChatGPT connector builder (Supabase advertises `registration_endpoint`; it does not advertise CIMD / `client_id_metadata_document_supported`). After ChatGPT DCR's a client for our app, add that exact `client_id` to `TRUSTED_OAUTH_CLIENT_IDS` in `core/src/logic/oauth/trustedOAuthClientIds.ts` so the consent screen treats it as verified.
4. ChatGPT Settings → the app → **Refresh** → **Scan Tools** → complete the OAuth prompt when shown.
5. Start a **new** conversation, select the app from the tools menu, and call a read tool (e.g. `get_me`). Do not reuse an old chat after metadata changes.

STANDARD_TESTS runs anonymous ChatGPT discovery against `/mcp/chatgpt` automatically via `mcp-http` (`pnpm --filter @videogen/api mcp:test -- --transport http --env <env> --server-mode remote`), which invokes the Inspector CLI before the authenticated full smoke and asserts `open_uploader` advertises `noauth` and API tools advertise `oauth2`. That scheme check fails against a host that has not yet been redeployed with this metadata.
