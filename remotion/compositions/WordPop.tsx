import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { CompositionFrame } from "../shared/frame";
import { textContainerStyle, textStyle } from "../shared/text";

const CHUNK = 4;

export const WordPop: React.FC<KineticProps> = (props) => {
  const { fps, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const time = frame / fps;
  const words = props.schedule.words;
  let activeIndex = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (time >= words[i].start) {
      activeIndex = i;
      break;
    }
  }
  if (activeIndex < 0) return null;
  const chunkStart = Math.floor(activeIndex / CHUNK) * CHUNK;
  const chunk = words.slice(chunkStart, chunkStart + CHUNK);
  return (
    <CompositionFrame {...props}>
      <AbsoluteFill style={{ ...textContainerStyle(props), alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {chunk.map((word, i) => {
            const globalIndex = chunkStart + i;
            const delay = (word.start - words[chunkStart].start) * fps;
            const scale = spring({
              frame: frame - delay,
              fps,
              config: { damping: 12, stiffness: 200, mass: 0.6 },
            });
            const active = globalIndex === activeIndex;
            return (
              <span
                key={i}
                style={{
                  ...textStyle(props),
                  display: "inline-block",
                  transform: `scale(${scale})`,
                  color: active ? props.highlightColor : props.textColor,
                  maxWidth: width - 160,
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
