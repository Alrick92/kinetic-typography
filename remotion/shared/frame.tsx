import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import type { KineticProps } from "./props";
import { Background } from "../backgrounds/Background";

export const CompositionFrame: React.FC<KineticProps & { children: React.ReactNode }> = ({
  children,
  ...props
}) => {
  return (
    <AbsoluteFill>
      <Background {...props} />
      {children}
      <Audio src={staticFile(props.audioFileName)} />
    </AbsoluteFill>
  );
};
