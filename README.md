# Kinetic Typography Pipeline

Converts an audio or video file (podcast, voiceover, lecture) into a hypnotype-style
kinetic typography MP4 — word-synced animated text, fully automated end to end.
Powered by [UniScribe](https://www.uniscribe.co) (transcription) and
[Remotion](https://www.remotion.dev) (rendering). Self-hosted, no third-party
render APIs.

- Input: mp3/m4a/wav/aac/ogg/opus/flac, or mp4/webm/mov (audio is extracted)
- Output: MP4 (H.264 + AAC), vertical 1080x1920 or landscape 1920x1080, configurable
- Triggers: CLI, or an n8n webhook that accepts an uploaded MP3 and returns the finished video

---

## 1. Quick start

```bash
npm install
npx remotion browser ensure          # one-time, downloads headless Chrome
cp .env.example .env                 # fill in UNISCRIBE_API_KEY
npm run render -- path/to/audio.mp3  # full pipeline
```

The finished video lands in `output/<basename>-kinetic.mp4`.

## 2. Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `UNISCRIBE_API_KEY` | yes | — | UniScribe API key (Settings → API Keys). Needs an active subscription/LTD plan. |
| `LANGUAGE_CODE` | no | `en` | ISO code of the spoken language (63 supported by UniScribe). |
| `PORT` | no | `3000` | Port for the webhook service. |
| `UNISCRIBE_WEBHOOK_URL` | no | — | Public HTTPS URL (e.g. your NGINX-hosted webhook) if you want UniScribe completion callbacks instead of pure polling. |

Rate limits on the UniScribe API key: 60 requests/minute, 1000/day. Every pipeline
run after the first for the same file + language skips UniScribe entirely
(transcript cached by sha256), so token-cost per view is zero.

## 3. CLI usage

```bash
npm run render -- <input-file> [config-path]
npm run render -- podcast.mp3                      # default config/config.yml
npm run render -- podcast.mp3 config/landscape.yml # alternate config
npm run spike                                      # validate key + config, no billing
npm run server                                     # start the n8n webhook listener
```

Exit codes: `0` success, `1` pipeline failure, `2` usage error. All stages emit
newline-delimited JSON to stdout, e.g.:

```json
{"ts":"2026-09-16T23:01:01Z","level":"info","stage":"render","message":"progress 100%"}
```

Stages: `pipeline`, `uniscribe-upload`, `uniscribe-submit`, `transcription`,
`transcript-cache`, `render`, `webhook-job`, `server`.

## 4. Configuration (`config/config.yml`)

```yaml
resolution:
  width: 1080        # 1080x1920 vertical | 1920x1080 landscape
  height: 1920
  fps: 30

reveal:
  style: popin       # see styles table below

text:
  fontFamily: Inter
  size: 110
  color: "#111111"
  highlightColor: "#1a6b1a"
  strokeColor: "#000000"
  strokeWidth: 6
  position: center   # center | lower-third

background:
  type: solid        # solid | gradient | image | video | waveform
  solid: "#d3d3d3"
  gradient: { from: "#0f2027", to: "#2c5364", direction: vertical }
  image: ""          # path inside public/, e.g. public/bg.jpg (falls back to solid if unset)
  video: ""          # path inside public/, e.g. public/bg-loop.mp4 (same fallback)
  waveform:
    color: "#f5c518"

output:
  directory: output
  container: mp4
  crf: 18

branding:            # used by the orbit style
  host: Sarah Connor
  tag: On building calm software
  episode: EP. 12
  coverImage: ""     # path inside public/, falls back to a monogram disc
```

Media referenced here must exist in the project's `public/` directory. Any unset
image/video path falls back to the `solid` background (light grey default) — no
code changes needed to switch styling.

### Reveal styles

| Style | Look | Best for |
|---|---|---|
| `popin` | Short word groups popping in with spring physics | General use |
| `karaoke` | Full sentence visible, active word highlighted | Singalongs, lectures |
| `focus-word` | One giant boxed word at a time, next-word teaser | Motivation, hooks, rants |
| `clean-feed` | Minimal centered typing, ~7-word groups, blinking cursor | Shorts, clean thumbs |
| `orbit` | Radial 72-bar spectrum around cover art + title card | Podcasts, audiograms |

### Backgrounds

| Type | Value | Fallback |
|---|---|---|
| `solid` | hex color | — |
| `gradient` | from/to + vertical\|horizontal\|diagonal | solid color |
| `image` | file in `public/` | solid color (light grey default) |
| `video` | looped file in `public/` | solid color (light grey default) |
| `waveform` | bottom-frequency bars synced to amplitude | solid color |

## 5. Webhook service (for n8n / HTTP automation)

```bash
npm run server
```

| Endpoint | Method | Description |
|---|---|---|
| `/render` | POST | JSON body `{ "file_path": "/media/audio.mp3", "config_path": "config/config.yml", "language": "en" }` → `202 { "job_id": "...", "status": "queued" }`. Jobs run in-process, async. |
| `/jobs/:id` | GET | `{ id, status: queued\|processing\|completed\|failed, output, error }` |
| `/health` | GET | `{ ok: true }` liveness check (unauthenticated) |

### API-key protection

Set `WEBHOOK_API_KEY` in `.env` and both `/render` and `/jobs` require it:

```bash
curl -X POST https://kinetic.example.com/render \
  -H "X-API-Key: <WEBHOOK_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/media/podcast.mp3"}'
```

- Key comparison is timing-safe; an `Authorization: Bearer <key>` header is also accepted
- If `WEBHOOK_API_KEY` is unset the server **warns loudly and runs unprotected** — only acceptable behind a trusted network. In n8n workflows set the `KINETIC_API_KEY` env to the same value; both included workflow JSONs already send `X-API-Key` on every HTTP request node.

Example round trip:

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/media/podcast.mp3"}'
# -> {"job_id":"179cb93012cc","status":"queued"}

curl http://localhost:3000/jobs/179cb93012cc
# -> {"id":"179cb93012cc","status":"completed","output":"/app/output/...mp4"}
```

Behind NGINX Proxy Manager: point a hostname at the container's port 3000.
Jobs are idempotent — repeated triggers for identical files reuse cached transcripts.

## 6. n8n workflow

Two ready-to-import workflow files live in `n8n/`:

### a) `kinetic-video-upload-workflow.json` (recommended)

Accepts an **uploaded MP3 as binary** in a webhook and returns the **finished MP4
as binary** when the render completes:

```
Webhook (multipart MP3 upload, POST /webhook/kinetic-video)
  → Write Binary File (saves MP3 to the shared media volume)
  → POST /render (file_path of the saved MP3)
  → Wait 15s → GET /jobs/:id
      ├─ completed → Read Binary File (output MP4) → Respond with video binary
      ├─ failed    → fail the execution with the pipeline stage error
      └─ processing → loop back and poll again
```

Import it (Workflows → Import from File), then set:

- `KINETIC_API_URL` n8n variable/environment to the render service
  (`http://kinetic:3000` if same Docker network, or the proxied public URL)
- The "Write Binary File" / "Read Binary File" paths must be on a volume the
  render service also mounts (see `docker-compose.yml`, `/media`)

### b) `kinetic-render-workflow.json` (path-based variant)

Same shape, but the webhook takes a JSON body with a `file_path` already visible
to the render service and returns the output path JSON. Handy when upstream
systems already side-loaded the file.

## 7. Docker deployment

Dockerfile + docker-compose.yml included (target: Linux VPS, no GPU required).

```bash
docker compose up -d --build
```

Mounts: `output/`, `cache/`, `config/` (rw) and a media volume (ro). Expose only
port 3000 via NGINX Proxy Manager.

For render throughput: Remotion uses headless Chrome on CPU; a 46s clip renders
in ~2.5x real time on typical VPS cores. Scale threads via the container command
or run multiple replicas behind the proxy.

## 8. Error handling

Errors surface as stage-qualified messages and non-zero exit codes on the CLI,
HTTP error responses on the webhook service, and `status: "failed"` plus
`error` on the job endpoint. Common failure modes are translated to actionable
messages:

| Failing stage | Meaning |
|---|---|
| `uniscribe-auth` | Invalid/missing API key |
| `uniscribe-plan` | Plan lacks API access (requires active subscription/LTD) |
| `uniscribe-quota` | Minutes used up on your plan |
| `uniscribe-upload` | Pre-signed storage upload failed |
| `uniscribe-rate-limited` | 429 from UniScribe (60/min, 1000/day caps) |
| `transcription` | UniScribe task failed or polling timed out |
| `input` | Missing/unsupported file |
| `render` | Remotion render crashed |
| `pipeline` | Other failures |

## 9. Extending the pipeline

- **New reveal style**: add a React component in
  `src/remotion/KineticComposition.tsx`, add the style name to the `z.enum`
  in `src/types.ts` and `src/remotion/props.ts`, wire it into
  `KineticComposition`'s conditional render, and add it to the config README table.
- **New background type**: extend `Background` in the same file + `z.enum` lists.
- **Timestamp data**: word-level timings come straight from UniScribe's
  `result.segments[].words`. If a transcript ships phrase-level only, per-word
  timing is interpolated by character proportion within each phrase and the
  pipeline logs `granularity: phrase`.

## 10. Render engine decision

Remotion was chosen over an FFmpeg drawtext/ASS pipeline because React gives
precise per-word spring animations, staggered typing reveals, and the radial
spectrum orbit — none of which are practical via FFmpeg subtitle filters
(~would require rendering per-word PNGs or heavily hacked ASS templates).
CPU-only headless Chrome rendering is fast enough for VPS deployments.
