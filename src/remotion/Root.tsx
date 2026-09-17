import React from "react";
import { Composition } from "remotion";
import { KineticComposition } from "./KineticComposition";
import type { KineticProps } from "./props";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Kinetic"
      component={KineticComposition}
      durationInFrames={30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={
        {
          schedule: { words: [], sentences: [] },
          audioFileName: "audio.mp3",
          revealStyle: "popin",
          fontFamily: "Inter",
          fontSize: 110,
          textColor: "#111111",
          highlightColor: "#1a6b1a",
          strokeColor: "#000000",
          strokeWidth: 6,
          textPosition: "center",
          backgroundType: "solid",
          gradient: { from: "#0f2027", to: "#2c5364", direction: "vertical" },
          solidColor: "#d3d3d3",
          waveformColor: "#f5c518",
        } as KineticProps
      }
    />
  );
};
