import React from "react";
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { CompositionFrame } from "../shared/frame";
import { textStyle, useActiveWordIndex } from "../shared/text";
import { useAudioSamples } from "../backgrounds/Background";

export const ShowCard: React.FC<KineticProps> = (props) => {
  const { width, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const samples = useAudioSamples(props.audioFileName, 48);
  const title = props.show.title || "Show";
  const cover = props.show.coverImagePath;
  const circleSize = width * 0.34;
  const scale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });
  return (
    <div
      style={{
        position: "absolute",
        top: width * 0.12,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scale(${Math.min(scale, 1)})`,
      }}
    >
      <div
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: cover ? "transparent" : props.highlightColor,
          boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {cover ? (
          <Img
            src={staticFile(cover)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontFamily: props.fontFamily,
              fontSize: circleSize * 0.4,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: props.fontFamily,
          fontWeight: 800,
          fontSize: 64,
          marginTop: 40,
          color: props.textColor,
          textAlign: "center",
          maxWidth: width * 0.85,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 32, height: 60 }}>
        {(samples ?? new Array(48).fill(0)).map((v, i) => {
          const barHeight = Math.max(v * 160, 6);
          return (
            <div
              key={i}
              style={{
                width: 8,
                height: barHeight,
                borderRadius: 4,
                background: props.waveformColor,
              }}
            />
          );
        })}
      </div>
      {props.show.description ? (
        <div
          style={{
            fontFamily: props.fontFamily,
            fontSize: 30,
            color: props.textColor,
            opacity: 0.75,
            marginTop: 28,
            textAlign: "center",
            maxWidth: width * 0.8,
            lineHeight: 1.35,
          }}
        >
          {props.show.description}
        </div>
      ) : null}
    </div>
  );
};

export const VerticalShow: React.FC<KineticProps> = (props) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const words = props.schedule.words;
  const active = useActiveWordIndex(words);
  const caption = active >= 0 ? words[active] : null;
  const captionScale = caption
    ? spring({
        frame: frame - Math.round(caption.start * fps),
        fps,
        config: { damping: 12, stiffness: 200, mass: 0.6 },
      })
    : 0;
  return (
    <CompositionFrame {...props}>
      <ShowCard {...props} />
      {caption ? (
        <div
          style={{
            position: "absolute",
            bottom: 400,
            left: 80,
            right: 80,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              ...textStyle(props),
              display: "inline-block",
              transform: `scale(${captionScale})`,
              color: props.highlightColor,
            }}
          >
            {caption.text}
          </span>
        </div>
      ) : null}
    </CompositionFrame>
  );
};
