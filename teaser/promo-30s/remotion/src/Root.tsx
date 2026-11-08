import React from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { MAIN_FRAMES, Promo } from "./Composition";

const fontHandle = delayRender("Loading Dana");
Promise.all(
  [
    ["Regular", 400],
    ["Bold", 700],
  ].map(([w, n]) => {
    const face = new FontFace("Dana", `url(${staticFile(`fonts/Dana-${w}.woff2`)})`, { weight: String(n) });
    return face.load().then((f) => document.fonts.add(f));
  }),
).then(() => continueRender(fontHandle));

export const RemotionRoot: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={MAIN_FRAMES} fps={30} width={1920} height={1080} />
);
