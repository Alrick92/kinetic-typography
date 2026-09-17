import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function hashFile(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function transcriptCachePath(cacheDir: string, fileHash: string, language: string): string {
  return path.join(cacheDir, `transcript-${fileHash}-${language}.json`);
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
