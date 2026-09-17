import type { UniScribeResult } from "../uniscribe/client.js";
import type { RevealStyle, TranscriptSchedule } from "../types.js";
import { isPhraseBased } from "../types.js";
import { parseTranscript, hasWordTimestamps } from "../transcript/parse.js";
import { interpolatePhraseWords } from "../transcript/interpolate.js";
import { EmptyTranscriptError } from "../errors.js";
import { logInfo } from "../logger.js";

export function buildAnimationSchedule(
  result: UniScribeResult,
  style: RevealStyle
): { schedule: TranscriptSchedule; granularity: "word" | "phrase" } {
  const granularity: "word" | "phrase" = hasWordTimestamps(result.segments) ? "word" : "phrase";
  const parsed = parseTranscript(result);
  if (parsed.words.length === 0) {
    throw new EmptyTranscriptError(
      "Transcript produced no usable word timings — verify the audio or the UniScribe result."
    );
  }
  logInfo("schedule", `style=${style} timestamps=${granularity} cues=${isPhraseBased(style) ? "phrase" : "word"}`);
  return { schedule: { granularity: parsed.granularity, words: parsed.words, phrases: parsed.phrases }, granularity };
}

export { interpolatePhraseWords };
