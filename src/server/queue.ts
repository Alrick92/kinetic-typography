import { randomBytes } from "node:crypto";
import { logInfo, logError } from "../logger.js";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type Job = {
  id: string;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  position?: number;
  error?: string;
  output?: string;
};

type QueueTask = {
  job: Job;
  run: () => Promise<string>;
};

const MAX_CONCURRENCY = Math.max(1, Number(process.env.QUEUE_CONCURRENCY ?? 1));

const jobs = new Map<string, Job>();
const waiting: QueueTask[] = [];
let active = 0;

export function createJob(): Job {
  const job: Job = {
    id: randomBytes(16).toString("hex").slice(0, 12),
    status: "queued",
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function queueStats() {
  return {
    waiting: waiting.length,
    active,
    maxConcurrency: MAX_CONCURRENCY,
  };
}

function reindexPositions() {
  waiting.forEach((task, i) => {
    task.job.position = i + 1;
  });
}

function enqueue(task: QueueTask) {
  waiting.push(task);
  reindexPositions();
  logInfo("queue", `job ${task.job.id} queued (position ${task.job.position}, waiting ${waiting.length})`);
  pump();
}

function pump() {
  while (active < MAX_CONCURRENCY && waiting.length > 0) {
    const task = waiting.shift()!;
    reindexPositions();
    active += 1;
    const { job } = task;
    job.status = "processing";
    job.startedAt = Date.now();
    delete job.position;
    logInfo("queue", `job ${job.id} started (${active}/${MAX_CONCURRENCY} active, waiting ${waiting.length})`);

    task
      .run()
      .then((outputPath) => {
        job.status = "completed";
        job.output = outputPath;
        job.finishedAt = Date.now();
        logInfo("queue", `job ${job.id} completed: ${outputPath}`);
      })
      .catch((err: unknown) => {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.finishedAt = Date.now();
        logError("queue", `job ${job.id} failed: ${job.error}`);
      })
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

export function submitJob(run: () => Promise<string>): Job {
  const job = createJob();
  enqueue({ job, run });
  return job;
}
