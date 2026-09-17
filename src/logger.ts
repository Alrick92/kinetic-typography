type Level = "info" | "warn" | "error";

function emit(level: Level, stage: string, message: string) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    stage,
    message,
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logInfo(stage: string, message: string) {
  emit("info", stage, message);
}

export function logWarn(stage: string, message: string) {
  emit("warn", stage, message);
}

export function logError(stage: string, message: string) {
  emit("error", stage, message);
}
