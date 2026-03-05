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
  const hue = h % 360;
  const accentHue = (hue + 44 + (h % 40)) % 360;
  const glowHue = (hue + 188 + (h % 55)) % 360;
  const intensity = 0.35 + ((h % 50) / 100);

  return {
    backgroundColor: `hsl(${hue} 30% 10%)`,
    textColor: `hsl(${(hue + 8) % 360} 20% 88%)`,
    accentColor: `hsl(${accentHue} 76% 62%)`,
    glowColor: `hsl(${glowHue} 68% 56%)`,
    words: pickWords(h, title, artist),
    intensity,
  };
}
