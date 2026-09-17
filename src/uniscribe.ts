const BASE_URL = "https://api.uniscribe.co";

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

export class UniScribeError extends Error {
  constructor(
    message: string,
    public stage: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "UniScribeError";
  }
}

function describeHttpError(status: number, body: string): string {
  switch (status) {
    case 401:
    case 403:
      return `UniScribe rejected the API key (HTTP ${status}). Plan requires an active subscription/LTD plan with API access. Check UNISCRIBE_API_KEY or your plan tier.`;
    case 429:
      return `UniScribe rate limit hit (60 req/min, 1000 req/day). Retry later or contact support for higher limits.`;
    default:
      return `UniScribe HTTP ${status}: ${body.slice(0, 500)}`;
  }
}

async function callApi<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> }
): Promise<T> {
  const apiKey = process.env.UNISCRIBE_API_KEY;
  if (!apiKey) {
    throw new UniScribeError(
      "UNISCRIBE_API_KEY is not set in the environment.",
      "uniscribe-config"
    );
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      ...(init.headers ?? {}),
    },
  });
  const bodyText = await res.text();
  let json: ApiEnvelope<T> | null = null;
  try {
    json = JSON.parse(bodyText) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new UniScribeError(describeHttpError(res.status, bodyText), "uniscribe-api", res.status);
    throw new UniScribeError(`UniScribe returned non-JSON response: ${bodyText.slice(0, 500)}`, "uniscribe-api", res.status);
  }
  if (!json.success) {
    const code = json.error?.code;
    const message = json.error?.message ?? "Unknown UniScribe API error";
    if (code === 41000) {
      throw new UniScribeError("API access denied: requires an active subscription or LTD plan (Basic tier or above).", "uniscribe-plan");
    }
    if (code === 41001 || code === 41002 || code === 41009) {
      throw new UniScribeError(`Invalid or missing API key (${message}).`, "uniscribe-auth");
    }
    if (code === 30006) {
      throw new UniScribeError("Insufficient transcription quota on your UniScribe plan.", "uniscribe-quota");
    }
    throw new UniScribeError(`UniScribe API error ${code ?? ""}: ${message}`, "uniscribe-api", res.status);
  }
  if (!json.data) {
    throw new UniScribeError("UniScribe response missing data field.", "uniscribe-api", res.status);
  }
  return json.data;
}

export async function requestUploadUrls(params: {
  filename: string;
  fileSize: number;
}): Promise<{ upload_url: string; download_url: string; file_key: string }> {
  return callApi(`/api/v1/files/upload-url`, {
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

export async function uploadFileToStorage(
  uploadUrl: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const { createReadStream, statSync } = await import("node:fs");
  const { Readable } = await import("node:stream");
  const stat = statSync(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as BodyInit;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: stream,
    duplex: "half",
    headers: { "Content-Type": contentType, "Content-Length": String(stat.size) },
  } as RequestInit & { duplex: string });
  if (!res.ok) {
    throw new UniScribeError(`File upload failed: HTTP ${res.status}`, "uniscribe-upload");
  }
}

export async function createTranscription(params: {
  fileKey: string;
  filepath: string;
  languageCode: string;
  webhookUrl?: string;
}): Promise<{ id: string; status: string }> {
  const data = await callApi<{ id: string; status: string }>(`/api/v1/transcriptions`, {
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
  return data;
}

export async function getTranscriptionStatus(id: string): Promise<{
  status: string;
  error_message: string | null;
}> {
  return callApi(`/api/v1/transcriptions/${id}/status`, { method: "GET" });
}

export async function getTranscriptionDetails(
  id: string
): Promise<{ status: string; result?: UniScribeResult }> {
  return callApi(`/api/v1/transcriptions/${id}`, { method: "GET" });
}

export async function pollUntilComplete(
  id: string,
  opts: { intervalMs: number; timeoutMs: number; log: (msg: string) => void }
): Promise<void> {
  const started = Date.now();
  for (;;) {
    const data = await getTranscriptionStatus(id);
    opts.log(`status=${data.status}`);
    if (data.status === "completed") return;
    if (data.status === "failed") {
      throw new UniScribeError(
        `Transcription failed: ${data.error_message ?? "unknown error"}`,
        "transcription"
      );
    }
    if (Date.now() - started > opts.timeoutMs) {
      throw new UniScribeError(`Transcription polling timed out after ${opts.timeoutMs / 1000}s.`, "transcription");
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
}
