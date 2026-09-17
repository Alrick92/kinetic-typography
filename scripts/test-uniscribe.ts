import { UniScribeClient, type UniScribeResult } from "../src/uniscribe/client.js";
import { hasWordTimestamps } from "../src/transcript/parse.js";
import { logInfo, logError } from "../src/logger.js";
import { errorMessage, errorStage } from "../src/errors.js";
import { hashFile, transcriptCachePath, readCache } from "../src/cache.js";
import fs from "node:fs";

async function main() {
  const args = process.argv.slice(2);
  const transcribeIdx = args.indexOf("--transcribe");
  const sampleFile = transcribeIdx >= 0 ? args[transcribeIdx + 1] : undefined;

  let client: UniScribeClient;
  try {
    client = new UniScribeClient();
  } catch (err) {
    logError("uniscribe-auth", errorMessage(err));
    process.exit(1);
  }

  logInfo("test:uniscribe", `probing API key against ${process.env.UNISCRIBE_BASE_URL ?? "https://api.uniscribe.co"}`);
  try {
    await client.getTranscriptionStatus("0");
    logInfo("test:uniscribe", "unexpected: probe succeeded (should have been not-found)");
  } catch (err) {
    const msg = errorMessage(err);
    if (msg.includes("45001") || msg.includes("404") || msg.includes("not found")) {
      logInfo("test:uniscribe", "API key valid and plan tier has API access (probe job intentionally not found).");
    } else {
      logError(errorStage(err), `probe failed: ${msg}`);
      logError("test:uniscribe", "Fix UNISCRIBE_API_KEY / plan tier before relying on transcription.");
      process.exit(1);
    }
  }

  if (!sampleFile) {
    logInfo(
      "test:uniscribe",
      "Word-level granularity check skipped — run `npm run test:uniscribe -- --transcribe <audio-file>` to verify what your account returns (docs are marked Beta and may drift)."
    );
    return;
  }

  const samplePath = sampleFile;
  if (!fs.existsSync(samplePath)) {
    logError("input", `Sample file not found: ${samplePath}`);
    process.exit(1);
  }

  const fileHash = hashFile(samplePath);
  const cached = readCache<{ raw: UniScribeResult }>(transcriptCachePath(fileHash, "en"));
  if (cached) {
    reportGranularity(cached.raw, "(from cache — no API call made)");
    return;
  }

  logInfo("test:uniscribe", `transcribing ${samplePath} to inspect real timestamp granularity (costs minutes on your plan)`);
  try {
    const { result } = await client.transcribe({
      inputPath: samplePath,
      language: process.env.LANGUAGE_CODE ?? "en",
      mimeType: "audio/wav",
      intervalMs: 5000,
      timeoutMs: 15 * 60 * 1000,
      log: (msg) => logInfo("transcription", msg),
    });
    reportGranularity(result, "(fresh API call)");
  } catch (err) {
    logError(errorStage(err), errorMessage(err));
    process.exit(1);
  }
}

function reportGranularity(result: UniScribeResult, source: string): void {
  const wordLevel = hasWordTimestamps(result.segments);
  logInfo(
    "test:uniscribe",
    `timestamp granularity: ${wordLevel ? "word (segments[].words[])" : "phrase only — per-word timing will be interpolated"} ${source}`
  );
  const firstWords = result.segments
    .flatMap((s) => (s.words ?? []).slice(0, 3))
    .slice(0, 5);
  if (firstWords.length > 0) {
    logInfo("test:uniscribe", `sample words: ${JSON.stringify(firstWords)}`);
  }
}

main();
