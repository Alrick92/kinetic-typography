import express from "express";
import { timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runPipeline } from "../pipeline/run.js";
import { submitJob, getJob, queueStats } from "./queue.js";
import { logInfo, logWarn } from "../logger.js";

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
  const job = submitJob(() =>
    runPipeline(inputPath, config_path ?? "config/config.yml", language ?? "en").then(
      (result) => result.outputPath
    )
  );
  res.status(202).json({
    job_id: job.id,
    status: job.status,
    position: job.position,
  });
});

app.get("/jobs/:id", requireApiKey, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    position: job.status === "queued" ? job.position : undefined,
    output: job.output,
    error: job.error,
    created_at: new Date(job.createdAt).toISOString(),
    started_at: job.startedAt ? new Date(job.startedAt).toISOString() : undefined,
    finished_at: job.finishedAt ? new Date(job.finishedAt).toISOString() : undefined,
  });
});

app.get("/queue", requireApiKey, (_req, res) => {
  res.json(queueStats());
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  logInfo("server", `n8n webhook listener on :${port} (POST /render)`);
});
