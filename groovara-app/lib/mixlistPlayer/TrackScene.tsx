"use client";

import type { UiTrack } from "./types";
import { FloatingWords } from "./floating-words";
import {
  Flicker,
  Glow,
  Morph,
  Orbits,
  Particles,
  Pulses,
  Rays,
  Sparks,
  Waves,
} from "./scene-primitives";

type TrackSceneProps = {
  track: UiTrack;
  intensity?: number;
  showWords?: boolean;
};

export default function TrackScene({ track, intensity, showWords = true }: TrackSceneProps) {
  const strength = intensity ?? track.theme.intensity;
  const accent = track.theme.accentColor;
  const text = track.theme.textColor;
  const glow = track.theme.glowColor;
  const energy = track.id.length % 5;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <Glow x={18} y={20} size={900} color={accent} opacity={0.12 * strength} />
      <Glow x={80} y={70} size={980} color={glow} opacity={0.1 * strength} />
      <Morph x={68} y={24} size={640} color={accent} opacity={0.08 * strength} />
      <Morph x={26} y={76} size={560} color={glow} opacity={0.06 * strength} />

      <Particles
        count={10 + energy * 2}
        color={text}
        sizeRange={[1, 3]}
        speed={energy > 2 ? "medium" : "slow"}
        direction={energy % 2 === 0 ? "up" : "random"}
        opacity={0.22 * strength}
      />

      <Rays
        originX={50}
        originY={energy % 2 === 0 ? 100 : 0}
        count={7 + energy}
        length={500}
        spread={120}
        color={accent}
        opacity={0.08 * strength}
      />

      <Pulses
        x={50}
        y={52}
        count={2 + (energy % 3)}
        maxSize={380}
        color={glow}
        speed={energy > 2 ? "fast" : "slow"}
        opacity={0.08 * strength}
      />

      <Orbits
        x={50}
        y={48}
        count={4 + energy}
        radius={120}
        color={text}
        speed={energy > 2 ? "medium" : "slow"}
        opacity={0.2 * strength}
      />

      <Waves count={2 + (energy % 3)} color={accent} opacity={0.06 * strength} />

      {energy >= 3 ? <Sparks count={10} color={accent} opacity={0.25 * strength} /> : null}
      {energy === 4 ? <Flicker color={accent} /> : null}

      {showWords ? (
        <FloatingWords words={track.theme.words} accentColor={accent} textColor={text} />
      ) : null}
    </div>
  );
}
