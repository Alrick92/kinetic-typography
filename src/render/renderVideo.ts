import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { AppConfig, RevealStyle, TranscriptSchedule } from "../types.js";
import { resolveFontFamily } from "../../remotion/shared/fonts.js";
import { RenderCrashError } from "../errors.js";
import { logInfo } from "../logger.js";
import type { KineticProps } from "../../remotion/shared/props.js";

export const REVEAL_STYLE_TO_COMPOSITION: Record<RevealStyle, string> = {
  "word-pop": "WordPop",
  karaoke: "Karaoke",
  "focus-word": "FocusWord",
  "clean-feed": "CleanFeed",
  "lyrics-scroll": "LyricsScroll",
  "vertical-show": "VerticalShow",
  orbit: "Orbit",
};

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const remotionDir = path.join(projectRoot, "remotion");
const remotionPublic = path.join(remotionDir, "public");

export type RenderOptions = {
  config: AppConfig;
  schedule: TranscriptSchedule;
  audioFileName: string;
  outputName: string;
};

function copyIntoPublic(sourcePath: string, subdir: string): string | undefined {
  if (!sourcePath) return undefined;
  const absolute = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.join(projectRoot, "public", sourcePath);
  if (!fs.existsSync(absolute)) return undefined;
  const targetDir = path.join(remotionPublic, subdir);
  fs.mkdirSync(targetDir, { recursive: true });
  const fileName = path.basename(absolute);
  fs.copyFileSync(absolute, path.join(targetDir, fileName));
  return `${subdir}/${fileName}`;
}

function buildProps(options: RenderOptions): KineticProps {
  const { config } = options;
  const backgroundMedia = copyIntoPublic(config.background.mediaPath, "backgrounds");
  const show = { ...config.show };
  if (show.coverImagePath) {
    const copied = copyIntoPublic(show.coverImagePath, "show");
    show.coverImagePath = copied ?? "";
  }
  return {
    schedule: options.schedule,
    audioFileName: options.audioFileName,
    revealStyle: config.reveal.style,
    fontFamily: resolveFontFamily(config.text.font),
    fontSize: config.text.size,
    textColor: config.text.color,
    highlightColor: config.text.highlightColor,
    strokeColor: config.text.strokeColor,
    strokeWidth: config.text.strokeWidth,
    textPosition: config.text.position,
    backgroundType: config.background.type,
    backgroundColor: config.background.color,
    gradient: config.background.gradient,
    backgroundMediaPath: backgroundMedia ?? "",
    waveformColor: config.background.waveform.color,
    show,
  };
}

export async function renderVideo(options: RenderOptions): Promise<string> {
  const config = options.config;
  const { fps, width, height } = config.resolution;
  const lastWord = options.schedule.words[options.schedule.words.length - 1];
  const durationSeconds = lastWord.end + 1.0;
  const durationInFrames = Math.ceil(durationSeconds * fps);
  const compositionId = REVEAL_STYLE_TO_COMPOSITION[config.reveal.style];

  fs.mkdirSync(remotionPublic, { recursive: true });
  const audioDest = path.join(remotionPublic, "audio", path.basename(options.audioFileName));
  const audioSource = path.join(projectRoot, "public", options.audioFileName);
  fs.mkdirSync(path.dirname(audioDest), { recursive: true });
  fs.copyFileSync(audioSource, audioDest);

  const props = buildProps(options);

  try {
    logInfo("render", `bundling Remotion project (~10-40s on first run)`);
    const bundleLocation = await bundle({
      entryPoint: path.join(remotionDir, "index.ts"),
      publicDir: remotionPublic,
      webpackOverride: (c) => c,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: props as unknown as Record<string, unknown>,
    });
    composition.durationInFrames = durationInFrames;
    composition.fps = fps;
    composition.width = width;
    composition.height = height;

    const outDir = path.join(projectRoot, config.output.directory);
    fs.mkdirSync(outDir, { recursive: true });
    const outputPath = path.join(outDir, options.outputName);

    logInfo("render", `rendering ${compositionId} at ${width}x${height} @${fps}fps, ${durationInFrames} frames`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: props as unknown as Record<string, unknown>,
      audioCodec: "aac",
      crf: config.output.crf,
      onProgress: ({ progress }) => {
        if (Math.floor(progress * 100) % 10 === 0) {
          logInfo("render", `progress ${Math.floor(progress * 100)}%`);
        }
      },
    });
    logInfo("render", `output written: ${outputPath}`);
    return outputPath;
  } catch (err) {
    if (err instanceof RenderCrashError) throw err;
    throw new RenderCrashError(err instanceof Error ? err.message : String(err));
  }
}
