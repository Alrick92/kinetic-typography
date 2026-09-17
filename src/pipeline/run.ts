import path from "node:path";
import fs from "node:fs";
import { hashFile, transcriptCachePath, readCache, writeCache } from "../cache.js";
import { loadConfig } from "../config.js";
import { logInfo, logError } from "../logger.js";
import {
  requestUploadUrls,
  uploadFileToStorage,
  createTranscription,
  pollUntilComplete,
  getTranscriptionDetails,
  UniScribeError,
  type UniScribeResult,
} from "../uniscribe.js";
import { buildSchedule } from "../transcript.js";
import type { TranscriptSchedule } from "../types.js";

const SUPPORTED_EXTENSIONS = [
  ".mp3", ".mpeg", ".mpga", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".flac",
  ".mp4", ".webm", ".mov",
];

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
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

type CacheEntry = {
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
  projectRoot: string
): Promise<CacheEntry> {
  const fileHash = hashFile(inputPath);
  const cacheFile = transcriptCachePath(path.join(projectRoot, "cache"), fileHash, language);
  const cached = readCache<CacheEntry>(cacheFile);
  if (cached) {
    logInfo("transcript-cache", `cache hit for hash ${fileHash.slice(0, 12)}`);
    return cached;
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported input format "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
  }

  logInfo("uniscribe-upload", `requesting upload URL for ${path.basename(inputPath)}`);
  const upload = await requestUploadUrls({
    filename: path.basename(inputPath),
    fileSize: fs.statSync(inputPath).size,
  });
  logInfo("uniscribe-upload", `uploading to storage`);
  await uploadFileToStorage(
    upload.upload_url,
    inputPath,
    MIME_TYPES[ext] ?? "application/octet-stream"
  );

  logInfo("uniscribe-submit", `creating transcription`);
  const created = await createTranscription({
    fileKey: upload.file_key,
    filepath: path.basename(inputPath),
    languageCode: language,
    webhookUrl: process.env.UNISCRIBE_WEBHOOK_URL,
  });
  logInfo("transcription", `job created id=${created.id}`);

  await pollUntilComplete(created.id, {
    intervalMs: 5000,
    timeoutMs: 15 * 60 * 1000,
    log: (msg) => logInfo("transcription", msg),
  });

  const details = await getTranscriptionDetails(created.id);
  if (!details.result || details.result.segments.length === 0) {
    throw new Error("UniScribe returned completed status but an empty transcript.");
  }

  const granularity: "word" | "phrase" = details.result.segments.some(
    (s) => s.words && s.words.length > 0
  )
    ? "word"
    : "phrase";

  const entry: CacheEntry = {
    uniscribeId: created.id,
    granularity,
    raw: details.result,
  };
  writeCache(cacheFile, entry);
  logInfo("transcript-cache", `cached transcript for ${fileHash.slice(0, 12)}`);
  return entry;
}

export async function runPipeline(
  inputFile: string,
  configPathFromCwd: string,
  language: string
): Promise<PipelineResult> {
  const projectRoot = path.resolve(import.meta.dirname, "..", "..");
  const configPath = path.resolve(configPathFromCwd);
  const inputPath = path.resolve(inputFile);

  if (!fs.existsSync(inputPath)) {
    logError("input", `Input file not found: ${inputPath}`);
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const config = loadConfig(configPath);
  logInfo("pipeline", `starting pipeline for ${path.basename(inputPath)}`);

  const cacheEntry = await ensureTranscript(inputPath, language, projectRoot);
  logInfo("pipeline", `timestamp granularity: ${cacheEntry.granularity}`);

  const schedule: TranscriptSchedule = buildSchedule(cacheEntry.raw, 0);

  const audioFileName = `input${path.extname(inputPath).toLowerCase()}`;
  fs.mkdirSync(path.join(projectRoot, "public"), { recursive: true });
  fs.copyFileSync(inputPath, path.join(projectRoot, "public", audioFileName));

  const { renderVideo } = await import("./render.js");
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputName = `${baseName}-kinetic.${config.output.container}`;
  const outputPath = await renderVideo({
    configPath,
    schedule,
    audioFileName,
    outputName,
  });

  logInfo("pipeline", "done");
  return { outputPath, granularity: cacheEntry.granularity };
}
