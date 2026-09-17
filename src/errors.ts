export class PipelineError extends Error {
  constructor(
    message: string,
    public stage: string
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

export class InvalidApiKeyError extends PipelineError {
  constructor(message = "Invalid or missing UniScribe API key.") {
    super(message, "uniscribe-auth");
    this.name = "InvalidApiKeyError";
  }
}

export class PlanTierError extends PipelineError {
  constructor(
    message = "API access denied: your UniScribe plan tier lacks API access (Basic tier or above, active subscription/LTD required)."
  ) {
    super(message, "uniscribe-plan");
    this.name = "PlanTierError";
  }
}

export class QuotaError extends PipelineError {
  constructor(message = "Insufficient transcription minutes remaining on your UniScribe plan.") {
    super(message, "uniscribe-quota");
    this.name = "QuotaError";
  }
}

export class RateLimitError extends PipelineError {
  constructor(message = "UniScribe rate limit hit (60 req/min, 1000 req/day). Retry later.") {
    super(message, "uniscribe-rate-limited");
    this.name = "RateLimitError";
  }
}

export class UniScribeHttpError extends PipelineError {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message, "uniscribe-api");
    this.name = "UniScribeHttpError";
  }
}

export class TranscriptionFailedError extends PipelineError {
  constructor(message: string) {
    super(message, "transcription");
    this.name = "TranscriptionFailedError";
  }
}

export class TranscriptionTimeoutError extends PipelineError {
  constructor(timeoutSeconds: number) {
    super(`Transcription polling timed out after ${timeoutSeconds}s.`, "transcription");
    this.name = "TranscriptionTimeoutError";
  }
}

export class EmptyTranscriptError extends PipelineError {
  constructor(message = "UniScribe completed but returned an empty transcript — verify the audio has speech.") {
    super(message, "transcription");
    this.name = "EmptyTranscriptError";
  }
}

export class UnsupportedFormatError extends PipelineError {
  constructor(ext: string, supported: string[]) {
    super(`Unsupported input format "${ext}". Supported: ${supported.join(", ")}`, "input");
    this.name = "UnsupportedFormatError";
  }
}

export class InputNotFoundError extends PipelineError {
  constructor(filePath: string) {
    super(`Input file not found: ${filePath}`, "input");
    this.name = "InputNotFoundError";
  }
}

export class RenderCrashError extends PipelineError {
  constructor(message: string) {
    super(`Remotion render crashed: ${message}`, "render");
    this.name = "RenderCrashError";
  }
}

export class ConfigError extends PipelineError {
  constructor(message: string) {
    super(message, "config");
    this.name = "ConfigError";
  }
}

export function errorStage(err: unknown): string {
  return err instanceof PipelineError ? err.stage : "pipeline";
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
