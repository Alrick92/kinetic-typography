# HTTP API reference

Base URL: `http://<host>:<WEBHOOK_PORT>` (default `4000`).
Authentication is optional — see [Auth](#auth) below.

## POST /render

Starts a render job. Two mutually exclusive request shapes:

### 1. Direct upload (multipart/form-data)

```bash
curl -X POST http://localhost:4000/render \
  -H "X-API-Key: $API_KEY" \
  -F "audio=@episode.mp3" \
  -F "style=karaoke" \
  -F "language=en"
```

| Field | Type | Description |
|---|---|---|
| `audio` | file (required) | The audio/video file to transcribe + render |
| `style` | string | Reveal style override (`word-pop`, `karaoke`, `focus-word`, `clean-feed`, `lyrics-scroll`, `vertical-show`, `orbit`) |
| `language` | string | Spoken language ISO code (default `en`) |
| `config_overrides` | JSON string | Same shape as `configOverrides` below |

Works from any HTTP client; no shared filesystem needed.

### 2. Server-side path (JSON)

Use this in n8n when the audio file already exists on the render server's filesystem.

```bash
curl -X POST http://localhost:4000/render \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "audioFilePath": "/app/data/episode.mp3", "configOverrides": { "reveal": { "style": "karaoke" } } }'
```

| Field | Type | Description |
|---|---|---|
| `audioFilePath` | string (required) | Path to a file on the server filesystem |
| `configOverrides` | object | Shallow-merged per top-level section over `config/default.yaml` |
| `language` | string | Spoken language ISO code (default `en`) |

### Response (both modes)

`202 Accepted`:

```json
{
  "jobId": "179cb93012cc",
  "status": "queued",
  "statusUrl": "/render/179cb93012cc",
  "downloadUrl": "/render/179cb93012cc/download",
  "position": 1
}
```

`position` is only present while the job is queued. Renders run with a
concurrency of `QUEUE_CONCURRENCY` (default 1) — extra jobs wait in FIFO order.

Error responses:

| Status | Meaning |
|---|---|
| `400` | Missing file/field, file not found on server, invalid `configOverrides`, or invalid merged config (body includes `error` and `stage`) |
| `401` | Invalid/missing API key |

## GET /render/:jobId

Poll the job status (this is the `statusUrl` returned above):

```json
{
  "jobId": "179cb93012cc",
  "status": "processing",
  "createdAt": "2026-09-16T23:10:01.000Z",
  "startedAt": "2026-09-16T23:10:02.000Z"
}
```

`status` is one of `queued | processing | completed | failed`.

When `status` is `queued`, the body includes `position` (1-based queue position).
When `completed`, the body includes `outputPath` (path on the server filesystem).
When `failed`, the body includes `error` (human-readable message with the failing stage).

Unknown job id → `404 { "error": "job not found" }`.

## GET /render/:jobId/download

Download the finished MP4 (this is the `downloadUrl` returned above).

| Status | Meaning |
|---|---|
| `200` | `video/mp4` binary |
| `409` | Job not completed yet (body explains current status) |
| `404` | Unknown job id |
| `410` | Output file was deleted from disk after completion |

If you share a volume with the server, you can also read `outputPath` directly
from the completed job instead of downloading.

## GET /queue

```json
{ "waiting": 2, "active": 1, "maxConcurrency": 1 }
```

## GET /health

Liveness check, unauthenticated: `{ "ok": true }`

## Auth

Set `API_KEY` in the server's `.env` to protect every endpoint except `/health`.
Send it as either header:

- `X-API-Key: <key>`
- `Authorization: Bearer <key>`

Comparison is timing-safe. If `API_KEY` is unset the server logs a warning and
runs unprotected — only acceptable behind a trusted network.

## Job orchestration

- Jobs are held in-process (no external broker) and processed FIFO.
- Concurrency is controlled by `QUEUE_CONCURRENCY` (default 1).
- Transcripts are cached on disk keyed by the SHA-256 hash of the input file and
  language (`CACHE_DIR`, default `./.cache`), so re-runs — or a crash after
  transcription but before render — never re-call UniScribe for the same file.

## n8n usage

An HTTP Request node posts to `/render`, then a polling loop (n8n's "Wait" node
+ another HTTP Request node) checks `GET /render/:jobId` until `status` is
`completed`, then fetches `GET /render/:jobId/download` (or reads `outputPath`
from the shared volume). A ready-to-import workflow doing exactly this is at
`n8n/kinetic-render-workflow.json`, documented in
[docs/N8N_WORKFLOW.md](./N8N_WORKFLOW.md).
