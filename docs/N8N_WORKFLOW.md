# n8n workflow

Two ready-to-import workflows live in `n8n/`. Import via
**Workflows → Import from File**, then set the n8n environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `KINETIC_API_URL` | Render service base URL | `http://kinetic:4000` |
| `KINETIC_API_KEY` | Same value as the render server's `API_KEY` (sent as `X-API-Key` on every request) | — |
| `KINETIC_DATA_DIR` | Volume shared with the render container's `DATA_DIR` (upload workflow only) | `/app/data` |

Both workflows are *synchronous from the caller's point of view*: the webhook
accepts the request, the flow polls the render job, and the webhook response
carries the result.

---

## a) `kinetic-render-workflow.json` (path-based)

Flow:

```
Webhook (POST /webhook/kinetic-render, JSON body)
  → POST /render     { audioFilePath, language, configOverrides.reveal.style }
  → Wait 15s
  → GET /render/:jobId
      ├─ completed → respond { outputPath }
      ├─ failed    → fail the execution with the pipeline stage error
      └─ queued/processing → loop back and poll again
```

Payload example:

```json
{ "file_path": "/app/data/episode.mp3", "style": "karaoke", "language": "en" }
```

Response (after the poll loop finishes):

```json
{ "outputPath": "/app/output/episode-kinetic.mp4" }
```

Use this when upstream systems already side-load the audio file into the shared
`data` volume.

## b) `kinetic-video-upload-workflow.json` (binary upload → MP4 response)

Flow:

```
Webhook (multipart audio upload, POST /webhook/kinetic-video)
  → Write Binary File (saves the upload into the shared data volume)
  → POST /render     { audioFilePath of the saved file }
  → Wait 15s
  → GET /render/:jobId
      ├─ completed → Read Binary File (outputPath) → respond with the MP4 binary
      ├─ failed    → fail the execution with the pipeline stage error
      └─ queued/processing → loop back and poll again
```

The caller sends the audio as a binary field named `file`; optional `style` and
`language` fields choose the reveal style and spoken language. The finished MP4
is returned as a single binary response (`Content-Disposition: attachment`).

Volume requirement: the directory written by "Write Binary File" must be the
same directory the render container mounts at `DATA_DIR` (see
`docker-compose.yml`, `./data:/app/data`). The saved filename becomes
`audioFilePath` in the POST body.

## Adjusting the poll window

The "Wait 15s" node controls both poll interval and maximum total wait when
combined with n8n's workflow timeout — raise the interval for long episodes
(rough guideline: Remotion renders at ~2.5x real time per minute of audio on a
typical VPS CPU).
