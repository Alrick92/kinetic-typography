import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { useAudioSamples } from "./Background";

export const WaveformBackground: React.FC<KineticProps> = (props) => {
  const { width, height } = useVideoConfig();
  const samples = useAudioSamples(props.audioFileName, 64);
  if (samples === null) {
    return <AbsoluteFill style={{ backgroundColor: props.backgroundColor }} />;
  }
  const barWidth = width / samples.length;
  return (
    <AbsoluteFill style={{ backgroundColor: props.backgroundColor, justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", height: 500 }}>
        {samples.map((v, i) => {
          const barHeight = Math.max(v * height * 0.4, 4);
          return (
            <div
              key={i}
              style={{
                width: barWidth,
                height: barHeight,
                background: props.waveformColor,
                borderRadius: 6,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
