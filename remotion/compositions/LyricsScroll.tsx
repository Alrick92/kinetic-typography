import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { CompositionFrame } from "../shared/frame";
import { textStyle } from "../shared/text";

export const LyricsScroll: React.FC<KineticProps> = (props) => {
  const { fps, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const time = frame / fps;
  const phrases = props.schedule.phrases;
  if (phrases.length === 0) return null;

  let activeIndex = -1;
  for (let i = phrases.length - 1; i >= 0; i--) {
    if (time >= phrases[i].start) {
      activeIndex = i;
      break;
    }
  }
  if (activeIndex < 0) return null;

  const lineHeight = props.fontSize * 1.7;
  const targetOffset = activeIndex * lineHeight;
  const previousIndex = Math.max(0, activeIndex - 1);
  const previousOffset = previousIndex * lineHeight;
  const advanceStart = phrases[activeIndex].start * fps;
  const progress = interpolate(frame - advanceStart, [0, fps * 0.45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = progress * progress * (3 - 2 * progress);
  const offset = previousOffset + (targetOffset - previousOffset) * eased;

  return (
    <CompositionFrame {...props}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: height / 2 - lineHeight / 2,
            transform: `translateY(${-offset}px)`,
          }}
        >
          {phrases.map((phrase, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;
            const startFrame = phrase.start * fps;
            const fade = interpolate(frame - startFrame, [-fps * 0.2, 0], [0.3, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  height: lineHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 120px",
                }}
              >
                <span
                  style={{
                    ...textStyle(props),
                    WebkitTextStroke: undefined,
                    opacity: isPast ? 0.3 : isActive ? fade : 0.18,
                    fontWeight: isActive ? 800 : 500,
                    color: isActive ? props.highlightColor : props.textColor,
                    textAlign: "center",
                  }}
                >
                  {phrase.text}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </CompositionFrame>
  );
};
