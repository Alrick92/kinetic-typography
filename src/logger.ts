import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

function emit(level: "info" | "warn" | "error", stage: string, message: string): void {
  logger[level]({ stage, message });
}

export function logInfo(stage: string, message: string): void {
  emit("info", stage, message);
}

export function logWarn(stage: string, message: string): void {
  emit("warn", stage, message);
}

export function logError(stage: string, message: string): void {
  emit("error", stage, message);
}
