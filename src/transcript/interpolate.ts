import type { UniScribeSegment } from "../uniscribe/client.js";
import type { PhraseTiming, WordTiming } from "../types.js";

export function interpolatePhraseWords(seg: UniScribeSegment): PhraseTiming | null {
  const segWords = seg.text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (segWords.length === 0) return null;
  const duration = Math.max(seg.end - seg.start, 0.001);
  const charCounts = segWords.map((w) => w.length + 1);
  const totalChars = charCounts.reduce((a, b) => a + b, 0);
  const words: WordTiming[] = [];
  let cursor = seg.start;
  segWords.forEach((text, i) => {
    const portion = charCounts[i] / totalChars;
    const start = cursor;
    const end = Math.min(start + portion * duration, seg.end);
    words.push({ start, end, text });
    cursor = end;
  });
  return { start: seg.start, end: seg.end, text: seg.text, words };
}
