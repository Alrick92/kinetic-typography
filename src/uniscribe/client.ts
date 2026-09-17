import fs from "node:fs";
import {
  PipelineError,
  InvalidApiKeyError,
  PlanTierError,
  QuotaError,
  RateLimitError,
  UniScribeHttpError,
  TranscriptionFailedError,
  TranscriptionTimeoutError,
} from "../errors.js";

export const DEFAULT_BASE_URL = "https://api.uniscribe.co";

export type UniScribeWord = { start: number; end: number; text: string };
export type UniScribeSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: UniScribeWord[];
};

export type UniScribeResult = {
  text: string;
  segments: UniScribeSegment[];
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string; code: number; details?: string };
};

export type TranscriptionStatus = {
  status: string;
  error_message: string | null;
};

export class UniScribeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey ?? process.env.UNISCRIBE_API_KEY ?? "").trim();
    this.baseUrl = (baseUrl ?? process.env.UNISCRIBE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    if (!this.apiKey) {
      throw new InvalidApiKeyError(
        "UNISCRIBE_API_KEY is not set. Add it to your .env file."
      );
    }
  }

  async request<T>(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { "X-API-Key": this.apiKey, ...(init.headers ?? {}) },
      });
    } catch (err) {
      throw new UniScribeHttpError(
        `Could not reach UniScribe at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
        0
      );
    }
    const bodyText = await res.text();
    let json: ApiEnvelope<T> | null = null;
    try {
      json = JSON.parse(bodyText) as ApiEnvelope<T>;
    } catch {
      if (!res.ok) {
        throw new UniScribeHttpError(this.describeHttpError(res.status, bodyText), res.status);
      }
      throw new UniScribeHttpError(
        `UniScribe returned a non-JSON response: ${bodyText.slice(0, 300)}`,
        res.status
      );
    }
    if (!json.success) {
      const code = json.error?.code;
      const message = json.error?.message ?? "Unknown UniScribe API error";
      switch (code) {
        case 41000:
          throw new PlanTierError();
        case 41001:
        case 41002:
        case 41009:
          throw new InvalidApiKeyError(`${message} (code ${code}).`);
        case 30006:
          throw new QuotaError();
        case 42900:
        case 42901:
          throw new RateLimitError();
        default:
          throw new UniScribeHttpError(
            `UniScribe API error ${code ?? res.status}: ${message}`,
            res.status
          );
      }
    }
    if (!json.data) {
      throw new UniScribeHttpError("UniScribe response missing data field.", res.status);
    }
    return json.data;
  }

  private describeHttpError(status: number, body: string): string {
    switch (status) {
      case 401:
      case 403:
        return "UniScribe rejected the API key (HTTP 401/403). Check UNISCRIBE_API_KEY and that your plan tier has API access.";
      case 429:
        return "UniScribe rate limit hit (60 req/min, 1000 req/day). Retry later or request higher limits.";
      default:
        return `UniScribe HTTP ${status}: ${body.slice(0, 300)}`;
    }
  }

  requestUploadUrls(params: {
    filename: string;
    fileSize: number;
  }): Promise<{ upload_url: string; download_url: string; file_key: string }> {
    return this.request(`/api/v1/files/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: params.filename,
        file_size: params.fileSize,
        upload_expires_in: 3600,
        download_expires_in: 1800,
      }),
    });
  }

  async uploadFileToStorage(
    uploadUrl: string,
    filePath: string,
    contentType: string
  ): Promise<void> {
    const { createReadStream, statSync } = await import("node:fs");
    const { Readable } = await import("node:stream");
    const stat = statSync(filePath);
    let res: Response;
    try {
      res = await fetch(uploadUrl, {
        method: "PUT",
        body: Readable.toWeb(createReadStream(filePath)) as BodyInit,
        duplex: "half",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(stat.size),
        },
      } as RequestInit & { duplex: string });
    } catch (err) {
      throw new PipelineError(
        `Pre-signed storage upload failed: ${err instanceof Error ? err.message : String(err)}`,
        "uniscribe-upload"
      );
    }
    if (!res.ok) {
      throw new PipelineError(
        `Pre-signed storage upload failed: HTTP ${res.status}`,
        "uniscribe-upload"
      );
    }
  }

  createTranscription(params: {
    fileKey: string;
    filepath: string;
    languageCode: string;
    webhookUrl?: string;
  }): Promise<{ id: string; status: string }> {
    return this.request<{ id: string; status: string }>(`/api/v1/transcriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_key: params.fileKey,
        filename: params.filepath,
        language_code: params.languageCode,
        transcription_type: "transcript",
        enable_speaker_diarization: false,
        ...(params.webhookUrl ? { webhook_url: params.webhookUrl } : {}),
      }),
    });
  }

  getTranscriptionStatus(id: string): Promise<TranscriptionStatus> {
    return this.request(`/api/v1/transcriptions/${id}/status`, { method: "GET" });
  }

  getTranscriptionDetails(
    id: string
  ): Promise<{ status: string; result?: UniScribeResult }> {
    return this.request(`/api/v1/transcriptions/${id}`, { method: "GET" });
  }

  async pollUntilComplete(
    id: string,
    opts: { intervalMs: number; timeoutMs: number; log?: (msg: string) => void }
  ): Promise<TranscriptionStatus> {
    const started = Date.now();
    for (;;) {
      const status = await this.getTranscriptionStatus(id);
      opts.log?.(`status=${status.status}`);
      if (status.status === "completed") return status;
      if (status.status === "failed") {
        throw new TranscriptionFailedError(
          `UniScribe transcription failed: ${status.error_message ?? "unknown error"}`
        );
      }
      if (Date.now() - started > opts.timeoutMs) {
        throw new TranscriptionTimeoutError(Math.round(opts.timeoutMs / 1000));
      }
      await new Promise((r) => setTimeout(r, opts.intervalMs));
    }
  }

  async transcribe(params: {
    inputPath: string;
    language: string;
    mimeType: string;
    intervalMs: number;
    timeoutMs: number;
    webhookUrl?: string;
    log?: (msg: string) => void;
  }): Promise<{ id: string; result: UniScribeResult }> {
    const { basename } = await import("node:path");
    const upload = await this.requestUploadUrls({
      filename: basename(params.inputPath),
      fileSize: fs.statSync(params.inputPath).size,
    });
    await this.uploadFileToStorage(upload.upload_url, params.inputPath, params.mimeType);
    const created = await this.createTranscription({
      fileKey: upload.file_key,
      filepath: basename(params.inputPath),
      languageCode: params.language,
      webhookUrl: params.webhookUrl,
    });
    await this.pollUntilComplete(created.id, {
      intervalMs: params.intervalMs,
      timeoutMs: params.timeoutMs,
      log: params.log,
    });
    const details = await this.getTranscriptionDetails(created.id);
    if (!details.result) {
      throw new PipelineError("UniScribe completed but returned no result payload.", "transcription");
    }
    return { id: created.id, result: details.result };
  }
}
