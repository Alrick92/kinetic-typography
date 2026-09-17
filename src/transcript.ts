import type { UniScribeResult } from "./uniscribe.js";
import type { TranscriptSchedule, WordTiming, Sentence } from "./types.js";

function normalizeWord(text: string): string {
  return text.trim();
}

export function buildSchedule(
  result: UniScribeResult,
  durationSeconds: number
): TranscriptSchedule {
  const hasWordLevel = result.segments.some(
    (seg) => seg.words && seg.words.length > 0
  );

  const words: WordTiming[] = [];
  const sentences: Sentence[] = [];

  if (hasWordLevel) {
    for (const seg of result.segments) {
      const segWords = (seg.words ?? [])
        .map((w) => ({ start: w.start, end: Math.max(w.end, w.start), text: normalizeWord(w.text) }))
        .filter((w) => w.text.length > 0);
      if (segWords.length > 0) {
        sentences.push({
          start: seg.start,
          end: seg.end,
          words: segWords,
          text: seg.text,
        });
        words.push(...segWords);
      }
    }
    if (words.length === 0) {
      throw new Error("Word-level timestamps existed but produced empty schedule.");
    }
    words.sort((a, b) => a.start - b.start);
    return { granularity: "word", words, sentences };
  }

  for (const seg of result.segments) {
    const segWords: string[] = seg.text
      .split(/\s+/)
      .map(normalizeWord)
      .filter(Boolean);
    if (segWords.length === 0) continue;
    const dur = Math.max(seg.end - seg.start, 0.001);
    const charCounts = segWords.map((w) => w.length + 1);
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    const sentenceWords: WordTiming[] = [];
    let cursor = seg.start;
    segWords.forEach((w, i) => {
      const portion = charCounts[i] / totalChars;
      const start = cursor;
      const end = Math.min(start + portion * dur, seg.end);
      const timing: WordTiming = { start, end, text: w };
      sentenceWords.push(timing);
      words.push(timing);
      cursor = end;
    });
    sentences.push({
      start: seg.start,
      end: seg.end,
      words: sentenceWords,
      text: seg.text,
    });
  }

  if (words.length === 0) {
    throw new Error("Transcript produced no words — verify the audio or the UniScribe result.");
  }

  return { granularity: "phrase", words: words.sort((a, b) => a.start - b.start), sentences };
}

export function reservedUntil(schedule: TranscriptSchedule): number {
  const last = schedule.words[schedule.words.length - 1];
  return Math.max(last.end, 0);
}
