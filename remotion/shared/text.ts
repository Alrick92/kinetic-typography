import React from "react";
import type { CSSProperties } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "./props";
import type { WordTiming } from "../../src/types";

export function textStyle(props: KineticProps): CSSProperties {
  return {
    fontFamily: props.fontFamily,
    fontSize: props.fontSize,
    color: props.textColor,
    WebkitTextStroke:
      props.strokeWidth > 0 ? `${props.strokeWidth}px ${props.strokeColor}` : undefined,
    paintOrder: "stroke fill",
    fontWeight: 800,
    textAlign: "center",
    lineHeight: 1.25,
  };
}

export function useActiveWordIndex(words: WordTiming[]): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  for (let i = words.length - 1; i >= 0; i--) {
    if (time >= words[i].start) return i;
  }
  return -1;
}

export function textContainerStyle(props: KineticProps): CSSProperties {
  return props.textPosition === "center"
    ? { justifyContent: "center", padding: 80 }
    : { justifyContent: "flex-end", paddingBottom: 400, padding: 80 };
}
