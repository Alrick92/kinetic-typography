import type { TranscriptSchedule, RevealStyle, ShowMeta } from "../../src/types";

export type KineticProps = {
  schedule: TranscriptSchedule;
  audioFileName: string;
  revealStyle: RevealStyle;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  textPosition: "center" | "lower-third";
  backgroundType: "solid" | "gradient" | "video" | "waveform";
  backgroundColor: string;
  gradient: { from: string; to: string; angle: number };
  backgroundMediaPath?: string;
  waveformColor: string;
  show: ShowMeta;
};

export function defaultKineticProps(): KineticProps {
  return {
    schedule: { granularity: "word", words: [], phrases: [] },
    audioFileName: "audio/sample.mp3",
    revealStyle: "word-pop",
    fontFamily: "Space Grotesk",
    fontSize: 110,
    textColor: "#111111",
    highlightColor: "#1a6b1a",
    strokeColor: "#000000",
    strokeWidth: 6,
    textPosition: "center",
    backgroundType: "solid",
    backgroundColor: "#d3d3d3",
    gradient: { from: "#0f2027", to: "#2c5364", angle: 180 },
    backgroundMediaPath: undefined,
    waveformColor: "#f5c518",
    show: {
      title: "Show Title",
      coverImagePath: "",
      description: "",
      episodeLabel: "",
      totalChapters: 12,
    },
  };
}
