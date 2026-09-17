import { runPipeline } from "../src/pipeline.js";
import { writeCache, transcriptCachePath, hashFile } from "../src/cache.js";
import { loadConfig } from "../src/config.js";
import fs from "node:fs";

const input = "public/input.wav";
fs.mkdirSync(".cache", { recursive: true });
const h = hashFile(input);
const cacheFile = transcriptCachePath(h, "en");

writeCache(cacheFile, {
  uniscribeId: "smoke-test",
  granularity: "word",
  raw: {
    text: "This is a smoke test",
    segments: [
      {
        start: 0.0,
        end: 4.0,
        text: "This is a smoke",
        words: [
          { start: 0.0, end: 0.6, text: "This" },
          { start: 0.6, end: 1.4, text: "is" },
          { start: 1.4, end: 2.2, text: "a" },
          { start: 2.2, end: 4.0, text: "smoke" },
        ],
      },
      {
        start: 4.0,
        end: 9.0,
        text: "test of the pipeline",
        words: [
          { start: 4.0, end: 4.8, text: "test" },
          { start: 4.8, end: 5.6, text: "of" },
          { start: 5.6, end: 7.0, text: "the" },
          { start: 7.0, end: 9.0, text: "pipeline" },
        ],
      },
    ],
  },
});

const config = loadConfig();
runPipeline({ inputPath: input, config, language: "en" }).then((r) => {
  console.log("SMOKE RESULT", r);
});
