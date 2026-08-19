import type { UiTrackTheme } from "./types";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function tokenWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function pickWords(seed: number, title: string, artist: string): string[] {
  const tokens = [...new Set([...tokenWords(title), ...tokenWords(artist)])];
  const fallback = [
    "echo",
    "pulse",
    "memory",
    "night",
    "sound",
    "motion",
    "signal",
    "horizon",
  ];

  if (tokens.length === 0) return fallback;

  const chosen: string[] = [];
  let n = seed;
  for (let i = 0; i < Math.min(8, tokens.length); i++) {
    n = (n * 1664525 + 1013904223) >>> 0;
    chosen.push(tokens[n % tokens.length]);
  }

  return [...new Set(chosen)].slice(0, 8);
}

export function createTheme(seed: string, title: string, artist: string): UiTrackTheme {
  const h = hashSeed(seed);
  const intensity = 0.35 + ((h % 50) / 100);

  // Keep the player atmospheric, but make Plum the dominant brand accent.
  // Blue-Green and Brick appear occasionally; Sage is deliberately rare.
  const scenePalettes = [
    { accent: "#5B4B6E", glow: "#657681" },
    { accent: "#5B4B6E", glow: "#C8BCA2" },
    { accent: "#5B4B6E", glow: "#657681" },
    { accent: "#657681", glow: "#5B4B6E" },
    { accent: "#5B4B6E", glow: "#85866A" },
    { accent: "#A83B2C", glow: "#5B4B6E" },
  ] as const;

  const palette = scenePalettes[h % scenePalettes.length];

  return {
    backgroundColor: h % 3 === 0 ? "#292923" : "#1B1B19",
    textColor: "#F4EDDD",
    accentColor: palette.accent,
    glowColor: palette.glow,
    words: pickWords(h, title, artist),
    intensity,
  };
}
