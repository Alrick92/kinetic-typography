import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { CompositionFrame } from "../shared/frame";
import { textStyle, useActiveWordIndex } from "../shared/text";

const WINDOW = 7;

export const CleanFeed: React.FC<KineticProps> = (props) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const words = props.schedule.words;
  const active = useActiveWordIndex(words);
  if (active < 0) return null;
  const windowStart = Math.max(0, Math.min(active - Math.floor(WINDOW / 2), words.length - WINDOW));
  const window = words.slice(windowStart, windowStart + WINDOW);
  return (
    <CompositionFrame {...props}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 28 }}>
          {window.map((word, i) => {
            const globalIndex = windowStart + i;
            const isActive = globalIndex === active;
            const isUpcoming = globalIndex > active;
            const revealed = spring({
              frame: frame - Math.round(word.start * fps),
              fps,
              config: { damping: 100, stiffness: 200 },
            });
            return (
              <span
                key={i}
                style={{
                  ...textStyle(props),
                  WebkitTextStroke: undefined,
                  fontWeight: isActive ? 700 : 500,
                  opacity: isActive ? 1 : isUpcoming ? 0.25 : 0.45,
                  transform: `translateY(${(1 - revealed) * 14}px)`,
                  color: isActive ? props.highlightColor : props.textColor,
                  letterSpacing: 1,
                  display: "inline-block",
                }}
              >
                {word.text}
                {isActive && Math.floor(frame / 15) % 2 === 0 ? (
                  <span style={{ color: props.highlightColor }}>|</span>
                ) : null}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </CompositionFrame>
  );
};
