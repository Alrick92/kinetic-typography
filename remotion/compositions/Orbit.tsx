import React from "react";
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { CompositionFrame } from "../shared/frame";
import { textStyle, useActiveWordIndex } from "../shared/text";
import { useAudioSamples } from "../backgrounds/Background";

const ORBIT_BARS = 72;

export const Orbit: React.FC<KineticProps> = (props) => {
  const { fps, durationInFrames, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const samples = useAudioSamples(props.audioFileName, ORBIT_BARS) ?? new Array(ORBIT_BARS).fill(0);
  const words = props.schedule.words;
  const active = useActiveWordIndex(words);
  const word = active >= 0 ? words[active] : null;
  const orbitR = width * 0.31;
  const barLen = (i: number) => Math.max(samples[i % ORBIT_BARS] * width * 0.16, 12);
  const progress = frame / durationInFrames;
  const totalChapters = Math.max(1, props.show.totalChapters);
  const chapterIndex = Math.min(Math.floor(progress * totalChapters), totalChapters - 1);
  return (
    <CompositionFrame {...props}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: orbitR * 2, height: orbitR * 2, marginTop: -width * 0.18 }}>
          {new Array(ORBIT_BARS).fill(0).map((_, i) => {
            const angle = (i / ORBIT_BARS) * 2 * Math.PI;
            const len = barLen(i);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 7,
                  height: orbitR + len,
                  background: props.waveformColor,
                  transformOrigin: "top center",
                  transform: `translate(-50%, -100%) rotate(${angle}rad)`,
                  borderRadius: 4,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              inset: width * 0.06,
              borderRadius: "50%",
              overflow: "hidden",
              background: props.highlightColor,
            }}
          >
            {props.show.coverImagePath ? (
              <Img
                src={staticFile(props.show.coverImagePath)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
                <span
                  style={{
                    fontFamily: props.fontFamily,
                    fontSize: 120,
                    color: "#ffffff",
                    fontWeight: 800,
                  }}
                >
                  {(props.show.title || "V").slice(0, 1).toUpperCase()}
                </span>
              </AbsoluteFill>
            )}
          </div>
        </div>
        {word ? (
          <div
            style={{
              position: "absolute",
              bottom: 430,
              width: width * 0.8,
              textAlign: "center",
            }}
          >
            <span
              style={{
                ...textStyle(props),
                WebkitTextStroke: undefined,
                fontWeight: 800,
                letterSpacing: 2,
                fontSize: props.fontSize * 0.9,
                color: props.textColor,
                display: "inline-block",
              }}
            >
              {word.text}
            </span>
          </div>
        ) : null}
        <div style={{ position: "absolute", bottom: "12%", textAlign: "center", width: "100%" }}>
          <div
            style={{
              fontFamily: props.fontFamily,
              fontWeight: 900,
              fontSize: 64,
              letterSpacing: 2,
              color: props.textColor,
            }}
          >
            {(props.show.title || "").toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: props.fontFamily,
              fontSize: 22,
              letterSpacing: 6,
              color: props.textColor,
              opacity: 0.8,
              marginTop: 14,
              textTransform: "uppercase",
            }}
          >
            {[props.show.description, props.show.episodeLabel].filter(Boolean).join(" — ")}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
            {new Array(totalChapters).fill(0).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 3,
                  background: i < chapterIndex ? props.highlightColor : "transparent",
                  border: `3px solid ${props.textColor}`,
                }}
              />
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </CompositionFrame>
  );
};
