import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConfigError } from "./errors.js";

export function cacheDir(): string {
  const configured = process.env.CACHE_DIR ?? path.join(process.cwd(), ".cache");
  if (!configured) {
    throw new ConfigError("CACHE_DIR resolved to an empty path.");
  }
  fs.mkdirSync(configured, { recursive: true });
  return configured;
}

export function dataDir(): string {
  const configured = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(configured, { recursive: true });
  return configured;
}

export function outputDir(configured: string): string {
  const env = process.env.OUTPUT_DIR;
  const dir = env || path.join(process.cwd(), configured);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function hashFile(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function transcriptCachePath(fileHash: string, language: string): string {
  return path.join(cacheDir(), `transcript-${fileHash}-${language}.json`);
}

export function readCache<T>(cachePath: string): T | null {
  if (!fs.existsSync(cachePath)) return null;
  const content = fs.readFileSync(cachePath, "utf8");
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function writeCache(cachePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}
