import express from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runPipeline } from "../pipeline/run.js";
import { logInfo, logError, logWarn } from "../logger.js";

const app = express();
app.use(express.json());

const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!WEBHOOK_API_KEY) {
    logWarn("server", "WEBHOOK_API_KEY not set — endpoints are UNPROTECTED");
    next();
    return;
  }
  const provided =
    (req.get("x-api-key") || "").trim() ||
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const expected = Buffer.from(WEBHOOK_API_KEY);
  const given = Buffer.from(provided);
  if (
    given.length === expected.length &&
    timingSafeEqual(given, expected)
  ) {
    next();
    return;
  }
  logWarn("server", `auth rejection from ${req.ip}`);
  res.status(401).json({ error: "Invalid or missing API key (send X-API-Key header)" });
}

type Job = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  error?: string;
  output?: string;
};

const jobs = new Map<string, Job>();

app.post("/render", requireApiKey, (req, res) => {
  const { file_path, config_path, language } = req.body as {
    file_path?: string;
    config_path?: string;
    language?: string;
  };
  if (!file_path) {
    res.status(400).json({ error: "file_path is required in JSON body" });
    return;
  }
  const inputPath = path.resolve(file_path);
  if (!fs.existsSync(inputPath)) {
    res.status(400).json({ error: `File not found: ${inputPath}` });
    return;
  }
  const jobId = randomBytes(16).toString("hex").slice(0, 12);
  const job: Job = { id: jobId, status: "queued" };
  jobs.set(jobId, job);
  res.status(202).json({ job_id: jobId, status: "queued" });

  job.status = "processing";
  runPipeline(inputPath, config_path ?? "config/config.yml", language ?? "en")
    .then((result) => {
      job.status = "completed";
      job.output = result.outputPath;
      logInfo("webhook-job", `job ${jobId} completed: ${result.outputPath}`);
    })
    .catch((err: unknown) => {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      logError("webhook-job", `job ${jobId} failed: ${job.error}`);
    });
});

app.get("/jobs/:id", requireApiKey, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json({ id: job.id, status: job.status, output: job.output, error: job.error });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  logInfo("server", `n8n webhook listener on :${port} (POST /render)`);
});
