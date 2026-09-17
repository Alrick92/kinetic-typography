import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import {
  REVEAL_STYLES,
  BACKGROUND_TYPES,
  type AppConfig,
  type RevealStyle,
} from "./types.js";
import { ConfigError } from "./errors.js";

const color = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "hex color");

const configSchema = z.object({
  resolution: z.object({
    width: z.number().int().min(360).max(3840),
    height: z.number().int().min(360).max(3840),
    fps: z.number().int().min(24).max(60),
  }),
  reveal: z.object({
    style: z.enum(REVEAL_STYLES),
  }),
  text: z.object({
    font: z.string(),
    size: z.number().min(20).max(400),
    color,
    highlightColor: color,
    strokeColor: color,
    strokeWidth: z.number().min(0).max(40),
    position: z.enum(["center", "lower-third"]),
  }),
  background: z.object({
    type: z.enum(BACKGROUND_TYPES),
    color: color,
    gradient: z.object({
      from: color,
      to: color,
      angle: z.number().min(0).max(360),
    }),
    mediaPath: z.string(),
    waveform: z.object({
      color: color,
    }),
  }),
  show: z.object({
    title: z.string(),
    coverImagePath: z.string(),
    description: z.string(),
    episodeLabel: z.string(),
    totalChapters: z.number().int().min(1).max(50),
  }),
  output: z.object({
    directory: z.string(),
    container: z.string(),
    crf: z.number().min(0).max(51),
  }),
  transcription: z.object({
    mode: z.enum(["poll", "webhook"]),
    intervalMs: z.number().int().min(1000),
    timeoutMs: z.number().int().min(10_000),
  }),
});

export type ConfigOverrides = Record<string, Record<string, unknown> | undefined>;

export function shallowMergeOverrides(
  base: z.infer<typeof configSchema>,
  overrides: ConfigOverrides | undefined
): z.infer<typeof configSchema> {
  if (!overrides) return base;
  const baseSections = base as unknown as Record<string, unknown>;
  const merged = { ...baseSections };
  for (const [section, patch] of Object.entries(overrides)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    if (section === "show") {
      merged[section] = { ...(baseSections.show as object), ...patch };
      continue;
    }
    merged[section] = { ...(baseSections[section] as object), ...patch };
  }
  return merged as z.infer<typeof configSchema>;
}

export function parseConfig(raw: unknown, source: string): AppConfig {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new ConfigError(`Invalid config "${source}": ${details}`);
  }
  return parsed.data;
}

export function projectRoot(): string {
  return path.resolve(import.meta.dirname, "..");
}

export function loadDefaultConfig(root: string): AppConfig {
  const defaultPath = path.join(root, "config", "default.yaml");
  if (!fs.existsSync(defaultPath)) {
    throw new ConfigError(`Default config file not found: ${defaultPath}`);
  }
  const raw = yaml.load(fs.readFileSync(defaultPath, "utf8")) as unknown;
  return parseConfig(raw, path.basename(defaultPath));
}

export function loadConfig(
  configPath?: string,
  overrides?: ConfigOverrides
): AppConfig {
  const root = projectRoot();
  let base = loadDefaultConfig(root);
  if (configPath) {
    const absolute = path.resolve(configPath);
    if (!fs.existsSync(absolute)) {
      throw new ConfigError(`Config file not found: ${absolute}`);
    }
    const raw = yaml.load(fs.readFileSync(absolute, "utf8")) as unknown;
    base = parseConfig(raw, path.basename(absolute));
  }
  return parseConfig(shallowMergeOverrides(base, overrides), "merged");
}

export function styleFromUnknown(style: string | undefined, fallback: RevealStyle): RevealStyle {
  if (style && (REVEAL_STYLES as readonly string[]).includes(style)) {
    return style as RevealStyle;
  }
  return fallback;
}
