import { runPipeline } from "./run.js";
import { logError } from "../logger.js";
import { UniScribeError } from "../uniscribe.js";

const args = process.argv.slice(2);
const inputFile = args[0];
const configPath = args[1] ?? "config/config.yml";
const language = process.env.LANGUAGE_CODE ?? "en";

if (!inputFile) {
  console.error("Usage: npm run render -- <input-audio-or-video-file> [config-path]");
  process.exit(2);
}

runPipeline(inputFile, configPath, language)
  .then((result) => {
    console.log(JSON.stringify({ output: result.outputPath }));
    process.exit(0);
  })
  .catch((err) => {
    if (err instanceof UniScribeError) {
      logError(err.stage, err.message);
    } else {
      logError("pipeline", err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  });
