import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { visualizeAudio, useAudioData } from "@remotion/media-utils";
import type { KineticProps } from "./props.js";
import type { WordTiming, Sentence } from "../types.js";

const DEFAULT_SOLID = "#d3d3d3";

const Background: React.FC<KineticProps> = (props) => {
  if (props.backgroundType === "image" && props.backgroundImage) {
    return (
      <Img
        src={staticFile(props.backgroundImage)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  if (props.backgroundType === "video" && props.backgroundVideo) {
    return (
      <OffthreadVideo
        src={staticFile(props.backgroundVideo)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  if (props.backgroundType === "waveform") {
    return <WaveformBackground {...props} />;
  }
  if (props.backgroundType === "gradient" && props.gradient) {
    const { from, to, direction } = props.gradient;
    const angle =
      direction === "vertical" ? "180deg" : direction === "horizontal" ? "90deg" : "135deg";
    return <AbsoluteFill style={{ background: `linear-gradient(${angle}, ${from}, ${to})` }} />;
  }
  return <AbsoluteFill style={{ backgroundColor: props.solidColor ?? DEFAULT_SOLID }} />;
};

const WaveformBackground: React.FC<KineticProps> = (props) => {
  const { fps, height, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const audioData = useAudioData(staticFile(props.audioFileName));
  if (audioData === null) {
    return <AbsoluteFill style={{ backgroundColor: props.solidColor ?? "#0a0a12" }} />;
  }
  const samples = visualizeAudio({
    audioData,
    fps,
    frame,
    numberOfSamples: 64,
    smoothing: true,
  });
  const barWidth = width / samples.length;
  return (
    <AbsoluteFill style={{ backgroundColor: props.solidColor ?? "#0a0a12", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", height: 500 }}>
        {samples.map((v, i) => {
          const barHeight = Math.max(v * height * 0.4, 4);
          return (
            <div
              key={i}
              style={{
                width: barWidth,
                height: barHeight,
                background: props.waveformColor ?? "#f5c518",
                borderRadius: 6,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const textStyle = (props: KineticProps): React.CSSProperties => ({
  fontFamily: props.fontFamily,
  fontSize: props.fontSize,
  color: props.textColor,
  WebkitTextStroke: `${props.strokeWidth}px ${props.strokeColor}`,
  paintOrder: "stroke fill",
  fontWeight: 800,
  textAlign: "center",
  lineHeight: 1.25,
});

const useActiveWord = (words: WordTiming[], fps: number): number => {
  const frame = useCurrentFrame();
  const time = frame / fps;
  for (let i = words.length - 1; i >= 0; i--) {
    if (time >= words[i].start) return i;
  }
  return -1;
};

const PopIn: React.FC<KineticProps> = (props) => {
  const { fps, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const time = frame / fps;
  const schedule = props.schedule as { words: WordTiming[] };
  const CHUNK = 4;
  let activeIndex = -1;
  for (let i = schedule.words.length - 1; i >= 0; i--) {
    if (time >= schedule.words[i].start) {
      activeIndex = i;
      break;
    }
  }
  if (activeIndex < 0) return null;
  const chunkStart = Math.floor(activeIndex / CHUNK) * CHUNK;
  const chunk = schedule.words.slice(chunkStart, chunkStart + CHUNK);
  return (
    <AbsoluteFill
      style={{
        justifyContent: props.textPosition === "center" ? "center" : "flex-end",
        paddingBottom: props.textPosition === "lower-third" ? 400 : 0,
        padding: 80,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", alignItems: "center" }}>
        {chunk.map((word, i) => {
          const globalIndex = chunkStart + i;
          const delay = (word.start - schedule.words[chunkStart].start) * fps;
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
  );
};

const Karaoke: React.FC<KineticProps> = (props) => {
  const { fps } = useVideoConfig();
  const time = useCurrentFrame() / fps;
  const schedule = props.schedule as { sentences: Sentence[] };
  let sentence: Sentence | null = null;
  for (const s of schedule.sentences) {
    if (time >= s.start && time < s.end) {
      sentence = s;
      break;
    }
  }
  if (!sentence) {
    const last = schedule.sentences[schedule.sentences.length - 1];
    if (last && time >= last.end) sentence = last;
  }
  if (!sentence) return null;
  let activeWordIndex = -1;
  sentence.words.forEach((w, i) => {
    if (time >= w.start) activeWordIndex = i;
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: props.textPosition === "center" ? "center" : "flex-end",
        paddingBottom: props.textPosition === "lower-third" ? 400 : 0,
        padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {sentence.words.map((word, i) => {
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
  );
};

const useActiveWordIndex = (words: WordTiming[]): number => {
  const { fps } = useVideoConfig();
  const time = useCurrentFrame() / fps;
  for (let i = words.length - 1; i >= 0; i--) {
    if (time >= words[i].start) return i;
  }
  return -1;
};

const FocusWord: React.FC<KineticProps> = (props) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const schedule = props.schedule as { words: WordTiming[] };
  const active = useActiveWordIndex(schedule.words);
  if (active < 0) return null;
  const word = schedule.words[active];
  const prev = schedule.words[active - 1];
  const next = schedule.words[active + 1];
  const scale = spring({
    frame: frame - Math.round(word.start * fps),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.5 },
  });
  const wordStyle: React.CSSProperties = {
    backgroundColor: props.highlightColor,
    color: props.strokeColor,
    padding: "24px 48px",
    fontWeight: 900,
    letterSpacing: 4,
    display: "inline-block",
    transform: `scale(${Math.min(scale, 1)})`,
    maxWidth: "90%",
    lineHeight: 1.05,
  };
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 100 }}>
      {prev ? (
        <div
          style={{
            position: "absolute",
            top: props.textPosition === "center" ? "18%" : "26%",
            ...textStyle(props),
            fontSize: props.fontSize * 0.6,
            fontWeight: 600,
            opacity: 0.25,
            filter: "grayscale(1)",
          }}
        >
          {prev.text}
        </div>
      ) : null}
      <div style={wordStyle}>
        <span style={{ fontSize: props.fontSize * 1.6 }}>{word.text}</span>
      </div>
      {next ? (
        <div
          style={{
            position: "absolute",
            bottom: props.textPosition === "center" ? "18%" : "26%",
            ...textStyle(props),
            fontSize: props.fontSize * 0.6,
            fontWeight: 600,
            opacity: 0.25,
            filter: "grayscale(1)",
          }}
        >
          {next.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const GROUP_SIZE = 7;

const CleanFeed: React.FC<KineticProps> = (props) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const schedule = props.schedule as { words: WordTiming[] };
  const active = useActiveWordIndex(schedule.words);
  if (active < 0) return null;
  const groupStart = Math.floor(active / GROUP_SIZE) * GROUP_SIZE;
  const group = schedule.words.slice(groupStart, groupStart + GROUP_SIZE);
  const activeInGroup = active - groupStart;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 28 }}>
        {group.map((word, i) => {
          const revealed = i <= activeInGroup;
          const pop = spring({
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
                fontWeight: 500,
                opacity: revealed ? 1 : 0,
                transform: `translateY(${(1 - pop) * 14}px)`,
                color: i === activeInGroup ? props.highlightColor : props.textColor,
                transition: "none",
                letterSpacing: 1,
              }}
            >
              {word.text}
              {i === activeInGroup && Math.floor(frame / 15) % 2 === 0 ? (
                <span style={{ color: props.highlightColor }}>|</span>
              ) : null}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ORBIT_BARS = 72;

const Orbit: React.FC<KineticProps> = (props) => {
  const { fps, durationInFrames, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const audioData = useAudioData(staticFile(props.audioFileName));
  const schedule = props.schedule as { words: WordTiming[] };
  const active = useActiveWordIndex(schedule.words);
  const word = active >= 0 ? schedule.words[active] : null;
  const samples = audioData
    ? visualizeAudio({ audioData, fps, frame, numberOfSamples: 64, smoothing: true })
    : (new Array(64).fill(0) as number[]);
  const orbitR = width * 0.31;
  const barLen = (i: number) => Math.max(samples[i % ORBIT_BARS] * width * 0.16, 12);
  const hue = Math.min(Math.floor((frame / durationInFrames) * 15), 15);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: orbitR * 2, height: orbitR * 2 }}>
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
                background: props.waveformColor ?? "#f5c518",
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
            background: "#222",
          }}
        >
          {props.coverImage ? (
            <Img
              src={staticFile(props.coverImage)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 120, color: "#fff", fontWeight: 800 }}>
                {(props.host ?? "V").slice(0, 1).toUpperCase()}
              </span>
            </AbsoluteFill>
          )}
        </div>
      </div>
      {word ? (
        <div style={{ position: "absolute", top: "56%", width: width * 0.8, textAlign: "center" }}>
          <span
            style={{
              ...textStyle(props),
              WebkitTextStroke: undefined,
              fontWeight: 800,
              letterSpacing: 2,
              fontSize: props.fontSize * 0.9,
              color: props.textColor,
            }}
          >
            {word.text}
          </span>
        </div>
      ) : null}
      <div style={{ position: "absolute", bottom: "16%", textAlign: "center", width: "100%" }}>
        <div
          style={{
            fontFamily: props.fontFamily,
            fontWeight: 900,
            fontSize: 64,
            letterSpacing: 2,
            color: props.textColor,
          }}
        >
          {(props.host ?? "").toUpperCase()}
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
          {[props.tag, props.episode].filter(Boolean).join(" — ")}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
          {new Array(15).fill(0).map((_, i) => (
            <div
              key={i}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                background: i < hue ? props.highlightColor ?? "#111" : "transparent",
                border: `3px solid ${props.textColor}`,
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const KineticComposition: React.FC<KineticProps> = (props) => {
  void useVideoConfig;
  return (
    <AbsoluteFill>
      <Background {...props} />
      {props.revealStyle === "popin" ? <PopIn {...props} /> : null}
      {props.revealStyle === "karaoke" ? <Karaoke {...props} /> : null}
      {props.revealStyle === "focus-word" ? <FocusWord {...props} /> : null}
      {props.revealStyle === "clean-feed" ? <CleanFeed {...props} /> : null}
      {props.revealStyle === "orbit" ? <Orbit {...props} /> : null}
      <Audio src={staticFile(props.audioFileName)} />
    </AbsoluteFill>
  );
};
