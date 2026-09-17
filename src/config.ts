import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { configSchema, type AppConfig } from "./types.js";

export function loadConfig(configPath: string): AppConfig {
  const absolute = path.resolve(configPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Config file not found: ${absolute}`);
  }
  const raw = yaml.load(fs.readFileSync(absolute, "utf8")) as unknown;
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid config "${path.basename(absolute)}":\n${parsed.error.message}`
    );
  }
  return parsed.data;
}
