export type UiTrackTheme = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  glowColor: string;
  words: string[];
  intensity: number;
};

export type UiTrack = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  image?: string | null;
  trackid?: string | null;
  url: string | null;
  platform: "youtube" | "spotify" | "apple" | "other";
  durationMs: number;
  notes?: string | null;
  theme: UiTrackTheme;
};
