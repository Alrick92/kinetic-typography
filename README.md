# Kinetic Typography Pipeline

Turns an audio file into a kinetic-typography MP4 (word-synced animated text over
a configurable background), using [UniScribe](https://www.uniscribe.co) for
transcription and [Remotion](https://www.remotion.dev) for rendering.
Self-hosted — no third-party render APIs.

## How it works

```
audio file → UniScribe (transcribe) → timestamp parse (+ interpolation fallback)
           → animation schedule (word-pop | karaoke) → Remotion render → MP4
```

- **Transcription** (`src/uniscribe/client.ts`): uploads the file via UniScribe's
  pre-signed URL flow, creates a transcription job, and either polls
  `GET /api/v1/transcriptions/{id}/status` or waits for a webhook callback
  (`transcription.mode: "webhook"` + `PUBLIC_BASE_URL`).
- **Timestamp parsing** (`src/transcript/parse.ts`): UniScribe returns
  word-level timestamps in `segments[].words[]`. If a given response only has
  phrase-level timestamps, `src/transcript/interpolate.ts` distributes each
  phrase's duration across its words proportionally to word length.
- **Animation schedule** (`src/animation/schedule.ts`): converts the transcript
  into either a flat list of word cues (used by `word-pop`, `focus-word`,
  `clean-feed`, and the caption strip in `vertical-show`/`orbit`) or phrase cues
  with per-word highlight windows (`karaoke`).
- **Rendering** (`src/render/renderVideo.ts` + `remotion/`): bundles the Remotion
  project and renders the composition matching `reveal.style` to MP4
  (H.264/AAC).
- **Orchestration**: `src/cli.ts` for one-shot CLI runs, `src/webhook.ts` for an
  HTTP API (direct file upload or n8n-friendly server-side path — full reference
  in [docs/API.md](docs/API.md)). Transcripts are cached to disk keyed by a
  SHA-256 hash of the audio file, so re-runs (or a crash after transcription but
  before render) never re-call UniScribe for the same file.

## Setup

```bash
npm install
cp .env.example .env   # fill in UNISCRIBE_API_KEY
```

Verify your UniScribe API key/tier and inspect the real timestamp granularity
your account gets back before relying on it:

```bash
npm run test:uniscribe
npm run test:uniscribe -- --transcribe <audio-file>   # full check (costs plan minutes)
```

### Required environment variables (.env)

| Variable | Description |
|---|---|
| `UNISCRIBE_API_KEY` | Your UniScribe API key (Basic tier or above required for API access) |
| `UNISCRIBE_BASE_URL` | Defaults to `https://api.uniscribe.co` |
| `CACHE_DIR` | Where transcripts/job-ids are cached (default `./.cache`) |
| `OUTPUT_DIR` | Not read directly — output directory is set in `config/default.yaml` under `output.directory` |
| `WEBHOOK_PORT` | Port for the HTTP API server (default `4000`) |
| `PUBLIC_BASE_URL` | Public URL this container is reachable at — only required if you trigger renders with transcription `mode: "webhook"` |
| `API_KEY` | Optional shared-secret for the HTTP API — see [docs/API.md](docs/API.md) |
| `LOG_LEVEL` | pino log level (default `info`) |

## CLI usage

```bash
npm run cli -- render --input ./data/episode.mp3
npm run cli -- render --input ./data/episode.mp3 --config ./config/karaoke.yaml
npm run cli -- render --input ./data/episode.mp3 --output episode-final.mp4 --language en
```

Exit codes are non-zero on any failure, with the failing stage and a
human-readable message logged (see `src/errors.ts` for the full list — invalid
API key, plan-tier access denied, rate limit, unsupported format, empty/failed
transcript, render crash).

## HTTP API / n8n usage

Start the server (`npm run webhook`, or via Docker — see below). Full endpoint
reference, request/response shapes, auth, and error handling:
[docs/API.md](docs/API.md).

Two ways to trigger a render:

**Direct upload** — `POST /render` as multipart/form-data with an audio file
field. Works from any HTTP client; no shared filesystem needed.

```bash
curl -X POST http://localhost:4000/render -F "audio=@episode.mp3" -F "style=karaoke"
```

**Server-side path** — `POST /render` as JSON with `audioFilePath` pointing to a
file already on the server's filesystem. This is the n8n-friendly mode: write
the incoming audio into the shared `./data` volume first (e.g. via n8n's "Move
Binary Data" + "Write Binary File" nodes), then call this endpoint with that
path.

```json
{ "audioFilePath": "/app/data/episode.mp3", "configOverrides": { "reveal": { "style": "karaoke" } } }
```

Both return `202 { jobId, statusUrl, downloadUrl }` immediately. Poll
`GET /render/:jobId` until `status` is `completed`, then fetch the file from
`GET /render/:jobId/download` (or read `outputPath` directly if you share a
volume).

In n8n: an HTTP Request node posts to `/render`, then a polling loop (n8n's
"Wait" node + another HTTP Request) checks `/render/:jobId` until done.

A ready-to-import n8n workflow doing exactly this — upload an audio file with
optional style/language fields, wait, and get the finished MP4 back as one
synchronous submission — is at `n8n/kinetic-render-workflow.json`
(path-based) and `n8n/kinetic-video-upload-workflow.json` (binary upload), both
documented in [docs/N8N_WORKFLOW.md](docs/N8N_WORKFLOW.md).

## Configuration

All rendering/styling knobs live in `config/default.yaml` (see that file for the
full schema: output resolution/orientation/fps, reveal style,
font/colors/stroke/position, background type, UniScribe poll timing). Override
any subset via `--config` (CLI) or `configOverrides` (webhook) — overrides are
shallow-merged per top-level section, no code changes needed.

### Reveal styles

| Style | Look |
|---|---|
| `word-pop` | One word centered on screen at a time, replaced as the audio progresses |
| `karaoke` | Full sentence/segment visible, active word rendered in `highlightColor` |
| `focus-word` | Word-pop, plus faded previous/next word context above and below, the active word on a rounded `highlightColor` card, an elapsed/total timer, and a bottom progress bar |
| `clean-feed` | Continuous flowing paragraph — a window of words around the current one, spoken word bold and in `highlightColor`, already-spoken words dimmed, upcoming words dimmer still. No scrolling/layout measurement; the window just shifts forward |
| `lyrics-scroll` | Song-lyrics style — one line (transcript phrase) per line, vertically centered; the current line is bold/highlighted, previous lines sit above (dimmed, already scrolled past), upcoming lines below. Smoothly animates to the next line's position each time the active phrase advances, rather than jumping instantly |
| `vertical-show` | A "show card" (circular cover image, title, horizontal waveform, description) in the upper frame, with word-pop captions in the lower third. Needs `show.title` / `show.coverImagePath` / `show.description` (see below) |
| `orbit` | Circular avatar with a radial audio-spectrum spike ring, title, description, episode label, and a chapter/progress dot indicator, with word-pop captions in the lower third. Needs the same `show.*` fields, plus `show.totalChapters` for the dots |

`vertical-show` and `orbit` already draw their own waveform/spectrum — pair them
with `background.type: solid` or `gradient`, not `waveform` (both would render).
A ready-made solid lime-green/dark-text look matching that combination is in
`config/presets/lime-show.yaml`:

```bash
npm run cli -- render -i data/episode.mp3 --config config/presets/lime-show.yaml --style orbit \
  --title "Sarah Connor" --cover-image data/sarah.jpg \
  --description "On Building Calm Software" --episode-label "EP. 12"
```

### Show metadata (`show.*`, and `--title` / `--cover-image` / `--description` / `--episode-label`)

Only used by `vertical-show` and `orbit`; ignored by every other reveal style.

| Field | CLI flag | Default when unset |
|---|---|---|
| `show.title` | `--title` | audio filename (without extension) |
| `show.coverImagePath` | `--cover-image` | none — renders a solid placeholder circle in `highlightColor` |
| `show.description` | `--description` | hidden if unset |
| `show.episodeLabel` | `--episode-label` | hidden if unset |
| `show.totalChapters` | — (config only) | `12` — dot count in the Orbit progress indicator |

Via the webhook, set these under `configOverrides.show` in the `POST /render`
body instead of dedicated fields.

### Background types

| Type | Behavior |
|---|---|
| `solid` | Flat `background.color` |
| `gradient` | Linear gradient between `background.gradient.from`/`to` at `angle` degrees |
| `video` | Looping video **or** static image; set `background.mediaPath` to a file path (it's copied into `remotion/public/backgrounds/` automatically at render time) |
| `waveform` | Animated audio-amplitude bars in `background.waveform.color` over `background.color`, driven by `@remotion/media-utils` |

## Extending

- **New reveal style**: add a composition under `remotion/compositions/`,
  register it in `remotion/Root.tsx`, add the style to `RevealStyle` in
  `src/types.ts` and to `REVEAL_STYLE_TO_COMPOSITION` in
  `src/render/renderVideo.ts`. It'll get the flat word-cue shape from
  `src/animation/schedule.ts` automatically unless you add it to
  `PHRASE_BASED_STYLES` there (for karaoke-style phrase grouping instead).
- **New background type**: add a component under `remotion/backgrounds/`, wire
  it into `remotion/backgrounds/Background.tsx`'s switch, and extend the
  `background` section of `config/default.yaml` + the zod schema in
  `src/config.ts`.
- **Fonts**: `text.font` defaults to `Space Grotesk`, actually loaded via
  `@remotion/google-fonts` in `remotion/shared/fonts.ts` (not just a CSS
  `font-family` string) so it renders correctly in headless Chrome without
  depending on the OS having it installed. Any other configured font name falls
  back to a generic system-font stack. To wire up a different Google Font the
  same way, swap the import in `fonts.ts` for another
  `@remotion/google-fonts/<FontName>` subpackage.

## Docker

```bash
cp .env.example .env   # fill in UNISCRIBE_API_KEY, PUBLIC_BASE_URL if using webhook mode
docker compose up -d --build
```

Drop audio files into `./data` on the host (mounted at `/app/data` in the
container) before calling `POST /render` with that in-container path. Rendered
MP4s land in `./output` on the host.

For one-off CLI renders inside the same image:

```bash
docker compose run --rm kinetic-typography npx tsx src/cli.ts render -i /app/data/episode.mp3
```

## Known open items (flagged per the original requirements doc)

- UniScribe's public OpenAPI docs (confirmed at build time) document word-level
  timestamps in `segments[].words[]`; `npm run test:uniscribe` re-verifies this
  against your actual account/plan before you rely on it, since the docs are
  marked "Beta" and may drift.
- Rate limits are documented as 60 req/min / 1000 req/day per API key — the
  client surfaces 429s as `RateLimitError` but does not currently auto-retry
  with backoff; add that in `UniScribeClient.request` if you hit it in practice.
- Remotion was chosen over the FFmpeg drawtext/ASS-subtitle fallback: it gives
  full React-based control over per-word animation (spring easing, karaoke
  highlighting, waveform visualization) without hand-rolling ASS timing math, at
  the cost of a heavier Docker image (headless Chromium) and slower
  render-per-second-of-video than pure FFmpeg filters. Revisit if VPS CPU/RAM
  becomes a bottleneck on long files.
