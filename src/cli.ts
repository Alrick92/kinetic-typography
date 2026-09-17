import path from "node:path";
import { loadConfig, type ConfigOverrides } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { logError, logInfo } from "./logger.js";
import { errorMessage, errorStage } from "./errors.js";
import { REVEAL_STYLES } from "./types.js";
import { styleFromUnknown } from "./config.js";

const USAGE = `Usage: npm run cli -- render --input <audio-or-video-file> [options]

Options:
  --input <path>          Input audio/video file (required)
  --config <path>         Alternate YAML config (merged over config/default.yaml)
  --output <name>         Output file name (default <basename>-kinetic.mp4)
  --language <code>       Spoken language ISO code (default en)
  --style <style>         Reveal style override: ${REVEAL_STYLES.join(" | ")}
  --title <text>          show.title (vertical-show / orbit)
  --cover-image <path>    show.coverImagePath
  --description <text>    show.description
  --episode-label <text>  show.episodeLabel
`;

type Args = Record<string, string>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i++;
  }
  return args;
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "render") {
    logError("cli", `Unknown command "${command ?? ""}" — only "render" is supported.`);
    process.stderr.write("\n" + USAGE);
    process.exit(2);
  }

  let args: Args;
  try {
    args = parseArgs(rest);
  } catch (err) {
    logError("cli", errorMessage(err));
    process.stderr.write("\n" + USAGE);
    process.exit(2);
  }

  const inputPath = args["input"];
  if (!inputPath) {
    logError("cli", "--input is required.");
    process.stderr.write("\n" + USAGE);
    process.exit(2);
  }

  try {
    const overrides: ConfigOverrides = {};
    if (args["style"]) (overrides as Record<string, unknown>).reveal = { style: args["style"] };
    const showPatch: Record<string, unknown> = {};
    if (args["title"]) showPatch.title = args["title"];
    if (args["cover-image"]) showPatch.coverImagePath = path.resolve(args["cover-image"]);
    if (args["description"]) showPatch.description = args["description"];
    if (args["episode-label"]) showPatch.episodeLabel = args["episode-label"];
    if (Object.keys(showPatch).length > 0) (overrides as Record<string, unknown>).show = showPatch;

    const config = loadConfig(args["config"], overrides);
    logInfo(
      "pipeline",
      `config loaded: ${config.resolution.width}x${config.resolution.height}, style=${config.reveal.style}`
    );

    runPipeline({
      inputPath,
      config,
      language: args["language"] ?? process.env.LANGUAGE_CODE ?? "en",
      outputName: args["output"]
        ? path.basename(args["output"])
        : undefined,
    })
      .then((result) => {
        process.stdout.write(JSON.stringify({ output: result.outputPath }) + "\n");
        process.exit(0);
      })
      .catch((err) => {
        logError(errorStage(err), errorMessage(err));
        process.exit(1);
      });
  } catch (err) {
    logError(errorStage(err), errorMessage(err));
    process.exit(1);
  }
}

main();
