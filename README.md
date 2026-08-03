# @videogen/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes the full [VideoGen API](https://docs.videogen.io) to any MCP client (Cursor, Claude Desktop, Windsurf, etc.). Your agent can generate videos from scripts, produce images / voiceovers / music / avatars, upload files, export and remix projects, and manage runs — all authenticated with your own API key.

It ships in two transports that expose an **identical tool surface**:

- **Local (stdio)** — the client launches `@videogen/mcp` as a subprocess and reads the key from `VIDEOGEN_API_KEY`.
- **Remote (Streamable HTTP)** — a hosted, multi-tenant HTTP server. Clients connect over the network and authenticate per request with `Authorization: Bearer <api-key>`; no key lives on the server.

This is distinct from the hosted **documentation** MCP at `https://docs.videogen.io/_mcp/server`, which only lets clients read the API docs. This server actually _executes_ the API.

## How it works

- Wraps the official [`@videogen/sdk`](https://www.npmjs.com/package/@videogen/sdk) and calls the live API through the SDK's authenticated passthrough.
- The local transport reads your key from `VIDEOGEN_API_KEY`; the remote transport reads it from each request's `Authorization: Bearer` header and builds a fresh, per-request server bound to that team (stateless — no session state is shared between requests).
- The key never leaves your machine except in requests to the VideoGen API (local), or is forwarded only to the VideoGen API for the duration of the request and never persisted (remote).
- Long-running operations (workflows, media tools, project exports) use **composite tools** that start the operation and, by default, poll until it finishes. Pass `wait: false` to return immediately with the run/execution id.

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
- Reads the API key or OAuth access token from the `Authorization: Bearer` header. In API-key mode a missing/blank token gets a `401` with a `WWW-Authenticate` challenge. When OAuth is enabled, tool discovery is served unauthenticated (so hosts can list tools) and a credential-less tool call returns an OAuth sign-in challenge on the tool result. The credential is forwarded only to the VideoGen API and never stored.
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

## Tools

### Workflows (end-to-end video)

`script_to_video`, `voiceover_to_video`, `slideshow_to_video`, `storyboard_to_video`, `list_workflow_runs`, `get_workflow_run`, `cancel_workflow_run`

### Media tools

`generate_image`, `generate_video_clip`, `text_to_speech`, `generate_sound_effect`, `generate_music`, `generate_avatar`, `vectorize_image`, `remove_image_background`, `remove_video_background`, `upscale_image`, `upscale_video`, `image_3d_effect`, `list_tool_executions`, `get_tool_execution`, `cancel_tool_execution`

### Projects

`list_projects`, `get_project`, `export_project`, `get_project_export`, `remix_project`, `list_project_remix_actions`

### Files

`upload_file`, `create_file_upload`, `get_file`, `list_files`, `open_uploader`

`open_uploader` is a **ChatGPT App** widget (remote server only): it renders an in-chat file picker (a React component served as an MCP UI resource) so a ChatGPT user can attach a file without pasting a link. It is a no-op on clients that don't render MCP Apps UI — those use `upload_file` / `create_file_upload` instead.

### Resources & account

`list_avatar_presenters`, `list_tts_voices`, `list_languages`, `get_me`, `get_app_deep_link`

The workflow, media-tool, and export tools are **composite**: they start the operation and, by default, poll until it reaches a terminal state. Pass `wait: false` to return immediately with the run/execution id, and optionally `pollIntervalMs` / `timeoutMs` to tune waiting. On the **hosted** (Streamable HTTP) server, wait windows are capped under Cloudflare's ~100s proxy read timeout so long generations return a still-running snapshot instead of a 524 — poll `get_tool_execution` / `get_workflow_run` / `get_project_export` to finish. `script_to_video`, `voiceover_to_video`, `slideshow_to_video`, and `storyboard_to_video` accept `remixActions` (provide at least two for a polished result); `prompt_to_video_clip` does **not** accept `remixActions`.

See the [full tool reference](https://docs.videogen.io/libraries/mcp) for every tool's parameters and its REST-endpoint mapping.

## Development

```bash
pnpm build           # bundle to dist/ (dist/index.js, dist/http.js, and the widget)
pnpm typecheck       # type-check
pnpm lint:fix        # lint

# Smoke test the local (stdio) server:
VIDEOGEN_API_KEY=your_key node dist/index.js

# Smoke test the remote (HTTP) server:
PORT=8080 node dist/http.js
#   Health:  curl http://localhost:8080/health
#   MCP:     curl -X POST http://localhost:8080/mcp \
#              -H 'Authorization: Bearer your_key' \
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
   - `GET https://<mcp-host>/.well-known/oauth-protected-resource/mcp` returns `200` with `resource` ending in `/mcp`.
   - `GET https://<mcp-host>/.well-known/oauth-protected-resource/mcp/chatgpt` returns `200` with `resource` ending in `/mcp/chatgpt`.
   - `npx -y @modelcontextprotocol/inspector@1.0.0 --cli https://<mcp-host>/mcp --transport http --method tools/list` lists ~35+ tools (including `open_uploader` as `noauth` and API tools as `oauth2`).
   - Anonymous `tools/call get_me` against `/mcp` returns HTTP **401** + `WWW-Authenticate` (Cursor / Claude).
   - Anonymous `tools/call get_me` against `/mcp/chatgpt` returns HTTP **200** with a tool-result `_meta["mcp/www_authenticate"]` challenge (ChatGPT).
2. In the ChatGPT app (e.g. **VideoGen (DEV)**), set the MCP URL to `https://<mcp-host>/mcp/chatgpt` (not `/mcp`). Copy the exact OAuth callback URL (`https://chatgpt.com/connector/oauth/{callback_id}`) into that environment's Supabase Auth OAuth client redirect allowlist.
3. Prefer **DCR** in the ChatGPT connector builder (Supabase advertises `registration_endpoint`; it does not advertise CIMD / `client_id_metadata_document_supported`).
4. ChatGPT Settings → the app → **Refresh** → **Scan Tools** → complete the OAuth prompt when shown.
5. Start a **new** conversation, select the app from the tools menu, and call a read tool (e.g. `get_me`). Do not reuse an old chat after metadata changes.

STANDARD_TESTS runs discovery against `/mcp` automatically via `mcp-http` (`pnpm --filter @videogen/api mcp:test -- --transport http --env <env> --server-mode remote`), which invokes the Inspector CLI before the authenticated full smoke and asserts `open_uploader` advertises `noauth` and API tools advertise `oauth2`. That scheme check fails against a host that has not yet been redeployed with this metadata.
