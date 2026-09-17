import { z } from "zod";

export const configSchema = z.object({
  resolution: z.object({
    width: z.number().int().min(360).max(3840),
    height: z.number().int().min(360).max(3840),
    fps: z.number().int().min(24).max(60),
  }),
  reveal: z.object({
    style: z.enum(["popin", "karaoke", "focus-word", "clean-feed", "orbit"]),
  }),
  text: z.object({
    fontFamily: z.string(),
    size: z.number(),
    color: z.string(),
    highlightColor: z.string(),
    strokeColor: z.string(),
    strokeWidth: z.number(),
    position: z.enum(["center", "lower-third"]),
  }),
  background: z.object({
    type: z.enum(["solid", "gradient", "image", "video", "waveform"]),
    gradient: z
      .object({
        from: z.string(),
        to: z.string(),
        direction: z.enum(["vertical", "horizontal", "diagonal"]),
      })
      .optional(),
    solid: z.string().optional(),
    image: z.string().optional(),
    video: z.string().optional(),
    waveform: z
      .object({
        color: z.string(),
      })
      .optional(),
  }),
  output: z.object({
    directory: z.string(),
    container: z.string(),
    crf: z.number(),
  }),
  branding: z
    .object({
      host: z.string().optional(),
      tag: z.string().optional(),
      episode: z.string().optional(),
      coverImage: z.string().optional(),
    })
    .optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export type WordTiming = {
  start: number;
  end: number;
  text: string;
};

export type Sentence = {
  start: number;
  end: number;
  words: WordTiming[];
  text: string;
};

export type TranscriptSchedule = {
  granularity: "word" | "phrase";
  words: WordTiming[];
  sentences: Sentence[];
};
