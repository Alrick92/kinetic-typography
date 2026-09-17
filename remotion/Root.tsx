import React from "react";
import { Composition } from "remotion";
import { WordPop } from "./compositions/WordPop";
import { Karaoke } from "./compositions/Karaoke";
import { FocusWord } from "./compositions/FocusWord";
import { CleanFeed } from "./compositions/CleanFeed";
import { LyricsScroll } from "./compositions/LyricsScroll";
import { VerticalShow } from "./compositions/VerticalShow";
import { Orbit } from "./compositions/Orbit";
import { defaultKineticProps, type KineticProps } from "./shared/props";

const defaults = defaultKineticProps();

const REGISTERED = [
  { id: "WordPop", component: WordPop },
  { id: "Karaoke", component: Karaoke },
  { id: "FocusWord", component: FocusWord },
  { id: "CleanFeed", component: CleanFeed },
  { id: "LyricsScroll", component: LyricsScroll },
  { id: "VerticalShow", component: VerticalShow },
  { id: "Orbit", component: Orbit },
] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {REGISTERED.map(({ id, component }) => (
        <Composition
          key={id}
          id={id}
          component={component as React.FC<KineticProps>}
          durationInFrames={30}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={defaults as unknown as KineticProps}
        />
      ))}
    </>
  );
};
