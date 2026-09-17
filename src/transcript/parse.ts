import type { UniScribeResult, UniScribeSegment } from "../uniscribe/client.js";
import type { WordTiming, PhraseTiming } from "../types.js";
import { interpolatePhraseWords } from "./interpolate.js";

export function hasWordTimestamps(segments: UniScribeSegment[]): boolean {
  return segments.some((seg) => seg.words && seg.words.length > 0);
}

function normalizeWord(text: string): string {
  return text.trim();
}

export type ParsedTranscript = {
  granularity: "word" | "phrase";
  words: WordTiming[];
  phrases: PhraseTiming[];
};

export function parseTranscript(result: UniScribeResult): ParsedTranscript {
  if (hasWordTimestamps(result.segments)) {
    return parseWordLevel(result);
  }
  return parsePhraseLevel(result);
}

function parseWordLevel(result: UniScribeResult): ParsedTranscript {
  const words: WordTiming[] = [];
  const phrases: PhraseTiming[] = [];
  for (const seg of result.segments) {
    const segWords = (seg.words ?? [])
      .map((w) => ({
        start: w.start,
        end: Math.max(w.end, w.start),
        text: normalizeWord(w.text),
      }))
      .filter((w) => w.text.length > 0);
    if (segWords.length === 0) continue;
    phrases.push({ start: seg.start, end: seg.end, text: seg.text, words: segWords });
    words.push(...segWords);
  }
  if (words.length === 0) {
    // Word arrays existed but produced no usable words — fall back to interpolation.
    return parsePhraseLevel(result);
  }
  words.sort((a, b) => a.start - b.start);
  return { granularity: "word", words, phrases };
}

function parsePhraseLevel(result: UniScribeResult): ParsedTranscript {
  const words: WordTiming[] = [];
  const phrases: PhraseTiming[] = [];
  for (const seg of result.segments) {
    const phrase = interpolatePhraseWords(seg);
    if (!phrase) continue;
    phrases.push(phrase);
    words.push(...phrase.words);
  }
  if (words.length === 0) {
    return { granularity: "phrase", words: [], phrases: [] };
  }
  words.sort((a, b) => a.start - b.start);
  return { granularity: "phrase", words, phrases };
}
