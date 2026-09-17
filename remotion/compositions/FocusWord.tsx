import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { CompositionFrame } from "../shared/frame";
import { textStyle, useActiveWordIndex } from "../shared/text";

const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const FocusWord: React.FC<KineticProps> = (props) => {
  const { fps, durationInFrames, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const words = props.schedule.words;
  const active = useActiveWordIndex(words);
  if (active < 0) return null;
  const word = words[active];
  const prev = words[active - 1];
  const next = words[active + 1];
  const totalSeconds = durationInFrames / fps;
  const scale = spring({
    frame: frame - Math.round(word.start * fps),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.5 },
  });
  const progress = frame / durationInFrames;
  const elapsed = word.start;
  const dimStyle: React.CSSProperties = {
    position: "absolute",
    top: "18%",
    ...textStyle(props),
    fontSize: props.fontSize * 0.6,
    fontWeight: 600,
    opacity: 0.25,
    filter: "grayscale(1)",
  };
  return (
    <CompositionFrame {...props}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 100 }}>
        {prev ? <div style={{ ...dimStyle, top: "18%" }}>{prev.text}</div> : null}
        <div
          style={{
            backgroundColor: props.highlightColor,
            color: props.strokeColor,
            padding: "24px 48px",
            fontWeight: 900,
            letterSpacing: 4,
            display: "inline-block",
            transform: `scale(${Math.min(scale, 1)})`,
            maxWidth: "90%",
            lineHeight: 1.05,
          }}
        >
          <span style={{ fontSize: props.fontSize * 1.6 }}>{word.text}</span>
        </div>
        {next ? <div style={{ ...dimStyle, top: "auto", bottom: "18%" }}>{next.text}</div> : null}
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 40,
          width: width - 200,
          left: 100,
          textAlign: "center",
          fontFamily: props.fontFamily,
          fontSize: 36,
          letterSpacing: 2,
          color: props.textColor,
          opacity: 0.75,
        }}
      >
        {formatTime(elapsed)} / {formatTime(totalSeconds)}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 100,
          width: width - 200,
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.25)",
        }}
      >
        <div
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            height: "100%",
            borderRadius: 5,
            background: props.highlightColor,
          }}
        />
      </div>
    </CompositionFrame>
  );
};
