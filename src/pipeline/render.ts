import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { loadConfig } from "../config.js";
import type { AppConfig, TranscriptSchedule } from "../types.js";
import { propsFromConfig } from "../remotion/props.js";
import { logInfo, logError } from "../logger.js";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");

export type RenderOptions = {
  configPath: string;
  schedule: TranscriptSchedule;
  audioFileName: string;
  outputName: string;
};

export async function renderVideo(options: RenderOptions): Promise<string> {
  const config = loadConfig(options.configPath);
  const { fps, width, height } = config.resolution;
  const lastWord = options.schedule.words[options.schedule.words.length - 1];
  const durationSeconds = lastWord.end + 1.0;
  const durationInFrames = Math.ceil(durationSeconds * fps);

  logInfo("render", `bundling Remotion project (~10-40s on first run)`);
  const bundleLocation = await bundle({
    entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"),
    webpackOverride: (c) => c,
  });

  const props = propsFromConfig(options.schedule, options.audioFileName, config);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "Kinetic",
    inputProps: props as unknown as Record<string, unknown>,
  });
  composition.durationInFrames = durationInFrames;
  composition.fps = fps;
  composition.width = width;
  composition.height = height;

  const target = composition;
  const outDir = path.join(projectRoot, config.output.directory);
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, options.outputName);

  logInfo("render", `rendering ${width}x${height} @${fps}fps, ${durationInFrames} frames`);
  await renderMedia({
    composition: target,
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
}
