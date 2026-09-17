import { loadConfig } from "../config.js";
import { getTranscriptionStatus } from "../uniscribe.js";
import { logInfo, logError } from "../logger.js";

async function main() {
  const apiKey = process.env.UNISCRIBE_API_KEY;
  if (!apiKey) {
    logError("spike", "UNISCRIBE_API_KEY not set — add it to .env before running this spike.");
    process.exit(1);
  }
  try {
    const config = loadConfig("config/config.yml");
    logInfo("spike", `config OK: ${config.resolution.width}x${config.resolution.height}, style=${config.reveal.style}`);
    const statuses = await getTranscriptionStatus("0");
    logInfo("spike", `API reachable, probe response status=${statuses.status ?? "(transcription not found — expected)"}`);
    logInfo("spike", "conclusion: API key + config valid; use Remotion renderer (see README tradeoff notes).");
  } catch (err) {
    if (err instanceof Error && err.message.includes("45001")) {
      logInfo("spike", "API key valid and plan tier has API access (probe job intentionally not found).");
      logInfo("spike", "conclusion: run a real audio file through 'npm run render -- <file>'.");
    } else {
      logError("spike", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }
}

main();
