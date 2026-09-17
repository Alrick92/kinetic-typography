import { z } from "zod";
import type { AppConfig } from "../types.js";
import type { TranscriptSchedule } from "../types.js";

export const kineticPropsSchema = z.object({
  schedule: z.any(),
  audioFileName: z.string(),
  revealStyle: z.enum(["popin", "karaoke", "focus-word", "clean-feed", "orbit"]),
  fontFamily: z.string(),
  fontSize: z.number(),
  textColor: z.string(),
  highlightColor: z.string(),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  textPosition: z.enum(["center", "lower-third"]),
  backgroundType: z.enum(["solid", "gradient", "image", "video", "waveform"]),
  gradient: z
    .object({
      from: z.string(),
      to: z.string(),
      direction: z.enum(["vertical", "horizontal", "diagonal"]),
    })
    .optional(),
  solidColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundVideo: z.string().optional(),
  waveformColor: z.string().optional(),
  host: z.string().optional(),
  tag: z.string().optional(),
  episode: z.string().optional(),
  coverImage: z.string().optional(),
});

export type KineticProps = z.infer<typeof kineticPropsSchema>;

export function propsFromConfig(
  schedule: TranscriptSchedule,
  audioFileName: string,
  config: AppConfig
): KineticProps {
  return {
    schedule,
    audioFileName,
    revealStyle: config.reveal.style,
    fontFamily: config.text.fontFamily,
    fontSize: config.text.size,
    textColor: config.text.color,
    highlightColor: config.text.highlightColor,
    strokeColor: config.text.strokeColor,
    strokeWidth: config.text.strokeWidth,
    textPosition: config.text.position,
    backgroundType: config.background.type,
    gradient: config.background.gradient,
    solidColor: config.background.solid ?? "#111111",
    backgroundImage: config.background.image || undefined,
    backgroundVideo: config.background.video || undefined,
    waveformColor: config.background.waveform?.color ?? "#f5c518",
    host: config.branding?.host,
    tag: config.branding?.tag,
    episode: config.branding?.episode,
    coverImage: config.branding?.coverImage,
  };
}
