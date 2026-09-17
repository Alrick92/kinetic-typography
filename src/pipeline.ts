import path from "node:path";
import fs from "node:fs";
import { hashFile, transcriptCachePath, readCache, writeCache } from "./cache.js";
import { UniScribeClient, type UniScribeResult } from "./uniscribe/client.js";
import { buildAnimationSchedule } from "./animation/schedule.js";
import { renderVideo } from "./render/renderVideo.js";
import { logInfo } from "./logger.js";
import type { AppConfig } from "./types.js";
import {
  InputNotFoundError,
  UnsupportedFormatError,
  PipelineError,
} from "./errors.js";

const SUPPORTED_EXTENSIONS = [
  ".mp3", ".mpeg", ".mpga", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".flac",
  ".mp4", ".webm", ".mov",
];

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".mpga": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

export type CacheEntry = {
  uniscribeId: string;
  granularity: "word" | "phrase";
  raw: UniScribeResult;
};

export type PipelineResult = {
  outputPath: string;
  granularity: "word" | "phrase";
};

export async function ensureTranscript(
  inputPath: string,
  language: string,
  config: AppConfig
): Promise<CacheEntry> {
  const fileHash = hashFile(inputPath);
  const cacheFile = transcriptCachePath(fileHash, language);
  const cached = readCache<CacheEntry>(cacheFile);
  if (cached) {
    logInfo("transcript-cache", `cache hit for hash ${fileHash.slice(0, 12)}`);
    return cached;
  }

  const client = new UniScribeClient();
  const webhookUrl =
    config.transcription.mode === "webhook" && process.env.PUBLIC_BASE_URL
      ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/internal/uniscribe-callback`
      : undefined;

  logInfo("uniscribe-upload", `requesting upload URL for ${path.basename(inputPath)}`);
  const { id, result } = await client.transcribe({
    inputPath,
    language,
    mimeType: MIME_TYPES[path.extname(inputPath).toLowerCase()] ?? "application/octet-stream",
    intervalMs: config.transcription.intervalMs,
    timeoutMs: config.transcription.timeoutMs,
    webhookUrl,
    log: (msg) => logInfo("transcription", msg),
  });

  const granularity: "word" | "phrase" = result.segments.some(
    (s) => s.words && s.words.length > 0
  )
    ? "word"
    : "phrase";

  if (!result.segments || result.segments.length === 0) {
    throw new PipelineError("UniScribe completed but returned an empty transcript.", "transcription");
  }

  const entry: CacheEntry = { uniscribeId: id, granularity, raw: result };
  writeCache(cacheFile, entry);
  logInfo("transcript-cache", `cached transcript for ${fileHash.slice(0, 12)}`);
  return entry;
}

export type PipelineInput = {
  inputPath: string;
  config: AppConfig;
  language: string;
  outputName?: string;
};

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const inputPath = path.resolve(input.inputPath);
  const config = input.config;

  if (!fs.existsSync(inputPath)) {
    throw new InputNotFoundError(inputPath);
  }
  const ext = path.extname(inputPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new UnsupportedFormatError(ext, SUPPORTED_EXTENSIONS);
  }

  logInfo("pipeline", `starting pipeline for ${path.basename(inputPath)}`);
  const cacheEntry = await ensureTranscript(inputPath, input.language, config);

  const { schedule, granularity } = buildAnimationSchedule(cacheEntry.raw, config.reveal.style);
  logInfo("pipeline", `timestamp granularity: ${granularity}`);

  const fileHash = hashFile(inputPath);
  const audioFileName = `audio/${fileHash.slice(0, 16)}${ext}`;
  const publicDir = path.join(projectRoot, "public");
  const audioDest = path.join(publicDir, audioFileName);
  fs.mkdirSync(path.dirname(audioDest), { recursive: true });
  fs.copyFileSync(inputPath, audioDest);

  const outputName =
    input.outputName ??
    `${path.basename(inputPath, path.extname(inputPath))}-kinetic.${config.output.container}`;
  const outputPath = await renderVideo({
    config,
    schedule,
    audioFileName,
    outputName,
  });

  logInfo("pipeline", "done");
  return { outputPath, granularity };
}
