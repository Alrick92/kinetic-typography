export const REVEAL_STYLES = [
  "word-pop",
  "karaoke",
  "focus-word",
  "clean-feed",
  "lyrics-scroll",
  "vertical-show",
  "orbit",
] as const;

export type RevealStyle = (typeof REVEAL_STYLES)[number];

export const BACKGROUND_TYPES = ["solid", "gradient", "video", "waveform"] as const;

export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export const PHRASE_BASED_STYLES = ["karaoke", "lyrics-scroll"] as const;

export function isPhraseBased(style: RevealStyle): boolean {
  return (PHRASE_BASED_STYLES as readonly string[]).includes(style);
}

export type WordTiming = {
  start: number;
  end: number;
  text: string;
};

export type PhraseTiming = {
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
};

export type TranscriptSchedule = {
  granularity: "word" | "phrase";
  words: WordTiming[];
  phrases: PhraseTiming[];
};

export type ShowMeta = {
  title: string;
  coverImagePath: string;
  description: string;
  episodeLabel: string;
  totalChapters: number;
};

export type AppConfig = {
  resolution: { width: number; height: number; fps: number };
  reveal: { style: RevealStyle };
  text: {
    font: string;
    size: number;
    color: string;
    highlightColor: string;
    strokeColor: string;
    strokeWidth: number;
    position: "center" | "lower-third";
  };
  background: {
    type: BackgroundType;
    color: string;
    gradient: { from: string; to: string; angle: number };
    mediaPath: string;
    waveform: { color: string };
  };
  show: ShowMeta;
  output: { directory: string; container: string; crf: number };
  transcription: { mode: "poll" | "webhook"; intervalMs: number; timeoutMs: number };
};
