import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";

const spaceGrotesk = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
});

export const DEFAULT_FONT_NAME = "Space Grotesk";

const GENERIC_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function resolveFontFamily(configured: string): string {
  const name = (configured ?? "").trim();
  if (!name || name.toLowerCase().replace(/[\s-]/g, "") === "spacegrotesk") {
    return spaceGrotesk.fontFamily;
  }
  return `${name}, ${GENERIC_STACK}`;
}
