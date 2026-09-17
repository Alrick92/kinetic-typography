import React from "react";
import { AbsoluteFill, interpolate, useVideoConfig, useCurrentFrame } from "remotion";
import type { KineticProps } from "../shared/props";
import type { PhraseTiming } from "../../src/types";
import { CompositionFrame } from "../shared/frame";
import { textContainerStyle, textStyle } from "../shared/text";

export const Karaoke: React.FC<KineticProps> = (props) => {
  const { fps } = useVideoConfig();
  const time = useCurrentFrame() / fps;
  const phrases = props.schedule.phrases;
  let phrase: PhraseTiming | null = null;
  for (const p of phrases) {
    if (time >= p.start && time < p.end) {
      phrase = p;
      break;
    }
  }
  if (!phrase) {
    const last = phrases[phrases.length - 1];
    if (last && time >= last.end) phrase = last;
  }
  if (!phrase) return null;
  let activeWordIndex = -1;
  phrase.words.forEach((w, i) => {
    if (time >= w.start) activeWordIndex = i;
  });
  return (
    <CompositionFrame {...props}>
      <AbsoluteFill style={{ ...textContainerStyle(props), alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {phrase.words.map((word, i) => {
            const opacity = interpolate(time, [word.start - 0.15, word.start], [0.4, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const active = i === activeWordIndex;
            return (
              <span
                key={i}
                style={{
                  ...textStyle(props),
                  opacity,
                  color: active ? props.highlightColor : props.textColor,
                  display: "inline-block",
                }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </CompositionFrame>
  );
};
