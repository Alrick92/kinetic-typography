import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { loadConfig, type ConfigOverrides } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { dataDir } from "./cache.js";
import { submitJob, getJob, queueStats } from "./queue.js";
import { logInfo, logWarn } from "./logger.js";
import { errorMessage, errorStage } from "./errors.js";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;

function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!API_KEY) {
    logWarn("server", "API_KEY not set — endpoints are UNPROTECTED (acceptable only on a trusted network)");
    next();
    return;
  }
  const provided =
    (req.get("x-api-key") || "").trim() ||
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const expected = Buffer.from(API_KEY);
  const given = Buffer.from(provided);
  if (given.length === expected.length && timingSafeEqual(given, expected)) {
    next();
    return;
  }
  logWarn("server", `auth rejection from ${req.ip}`);
  res.status(401).json({ error: "Invalid or missing API key (send X-API-Key header)" });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dataDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".mp3";
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
      cb(null, unique);
    },
  }),
  limits: { fileSize: 512 * 1024 * 1024 },
});

function isValidOverrides(value: unknown): value is ConfigOverrides {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

app.post("/render", requireApiKey, upload.single("audio"), (req, res) => {
  const isMultipart = (req.get("content-type") || "").includes("multipart/form-data");
  let inputPath: string | undefined;
  let overrides: ConfigOverrides = {};
  let language = "en";

  if (isMultipart) {
    if (!req.file) {
      res.status(400).json({ error: "Send an audio file in the 'audio' form field (multipart/form-data)" });
      return;
    }
    inputPath = req.file.path;
    const style = (req.body.style || "").toString().trim();
    if (style) (overrides as Record<string, unknown>).reveal = { style };
    const languageField = (req.body.language || "").toString().trim();
    if (languageField) language = languageField;
    const rawOverrides = (req.body.config_overrides || "").toString().trim();
    if (rawOverrides) {
      try {
        const parsed = JSON.parse(rawOverrides);
        if (!isValidOverrides(parsed)) throw new Error("not an object");
        overrides = { ...overrides, ...parsed };
      } catch {
        res.status(400).json({ error: "config_overrides must be a JSON object" });
        return;
      }
    }
  } else {
    const { audioFilePath, configOverrides, language: jsonLanguage } = (req.body ?? {}) as {
      audioFilePath?: string;
      configOverrides?: unknown;
      language?: string;
    };
    if (!audioFilePath) {
      res
        .status(400)
        .json({ error: 'audioFilePath is required in JSON body (or upload multipart/form-data with an "audio" field)' });
      return;
    }
    if (configOverrides !== undefined) {
      if (!isValidOverrides(configOverrides)) {
        res.status(400).json({ error: "configOverrides must be an object" });
        return;
      }
      overrides = configOverrides;
    }
    if (jsonLanguage) language = jsonLanguage;
    inputPath = path.resolve(audioFilePath);
    if (!fs.existsSync(inputPath)) {
      res.status(400).json({ error: `File not found on server filesystem: ${inputPath}` });
      return;
    }
  }

  try {
    const config = loadConfig(undefined, overrides);
    const job = submitJob(() =>
      runPipeline({ inputPath: inputPath!, config, language }).then((r) => r.outputPath)
    );
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      statusUrl: `/render/${job.id}`,
      downloadUrl: `/render/${job.id}/download`,
      position: job.position,
    });
  } catch (err) {
    res.status(400).json({
      error: errorMessage(err),
      stage: errorStage(err),
    });
  }
});

app.get("/render/:id", requireApiKey, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json({
    jobId: job.id,
    status: job.status,
    position: job.status === "queued" ? job.position : undefined,
    outputPath: job.status === "completed" ? job.outputPath : undefined,
    error: job.error,
    createdAt: new Date(job.createdAt).toISOString(),
    startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : undefined,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : undefined,
  });
});

app.get("/render/:id/download", requireApiKey, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  if (job.status !== "completed" || !job.outputPath) {
    res
      .status(409)
      .json({ error: `job is ${job.status}; the MP4 is only downloadable once status is completed` });
    return;
  }
  if (!fs.existsSync(job.outputPath)) {
    res.status(410).json({ error: `output file missing: ${job.outputPath}` });
    return;
  }
  res.download(job.outputPath);
});

app.get("/queue", requireApiKey, (_req, res) => {
  res.json(queueStats());
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.WEBHOOK_PORT ?? 4000);
app.listen(port, () => {
  logInfo("server", `kinetic-typography HTTP API on :${port} (POST /render)`);
});
