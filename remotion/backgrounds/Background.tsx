import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { visualizeAudio, useAudioData } from "@remotion/media-utils";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { KineticProps } from "../shared/props";
import { WaveformBackground } from "./Waveform";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isImageFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export const Background: React.FC<KineticProps> = (props) => {
  switch (props.backgroundType) {
    case "video":
      if (props.backgroundMediaPath) {
        return isImageFile(props.backgroundMediaPath) ? (
          <Img
            src={staticFile(props.backgroundMediaPath)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <OffthreadVideo
            src={staticFile(props.backgroundMediaPath)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        );
      }
      return <AbsoluteFill style={{ backgroundColor: props.backgroundColor }} />;
    case "gradient":
      return (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${props.gradient.angle}deg, ${props.gradient.from}, ${props.gradient.to})`,
          }}
        />
      );
    case "waveform":
      return <WaveformBackground {...props} />;
    case "solid":
    default:
      return <AbsoluteFill style={{ backgroundColor: props.backgroundColor }} />;
  }
};

export function useAudioSamples(audioFileName: string, numberOfSamples = 64): number[] | null {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const audioData = useAudioData(staticFile(audioFileName));
  if (audioData === null) return null;
  return visualizeAudio({ audioData, fps, frame, numberOfSamples, smoothing: true });
}
