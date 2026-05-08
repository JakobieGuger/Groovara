import { z } from "zod";

const MAX = {
  title: 120,
  globalMessage: 2000,
  finishingNote: 2000,
  songTitle: 300,
  artist: 200,
  album: 200,
  url: 2048,
  note: 2000,
};

const hasControlChars = (value: string) => /[\u0000-\u001F\u007F]/.test(value);

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine((v) => !hasControlChars(v), `${label} contains invalid control characters`);

const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .max(max, `${label} must be at most ${max} characters`)
      .refine((v) => !hasControlChars(v), `${label} contains invalid control characters`)
      .nullable()
  );

const ALLOWED_HOSTS = new Set([
  "open.spotify.com",
  "spotify.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "music.apple.com",
]);

export const externalUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(MAX.url, `URL must be at most ${MAX.url} characters`)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }, "URL must be a valid HTTPS Spotify, YouTube, or Apple Music link");

export const mixlistSongSchema = z.object({
  position: z.number().int().min(1),
  platform: z.string().trim().min(1, "Platform is required"),
  track_id: z.string().trim().min(1, "Track ID is required"),
  title: requiredText("Song title", MAX.songTitle),
  artist: requiredText("Artist", MAX.artist),
  album: optionalText("Album", MAX.album),
  url: externalUrlSchema,
  note: optionalText("Song note", MAX.note),
});

export const createMixlistFromTracklistSchema = z.object({
  source_tracklist_id: z.string().uuid("Invalid tracklist id"),
  title: requiredText("Mixlist title", MAX.title),
  message: optionalText("Message", MAX.globalMessage),
  finishing_note: optionalText("Finishing note", MAX.finishingNote),
  reveal_mode: z.boolean(),
  is_public: z.boolean(),
  include_song_notes: z.boolean(),
  songs: z.array(mixlistSongSchema).min(1, "At least one song is required"),
});

export type CreateMixlistFromTracklistInput = z.infer<
  typeof createMixlistFromTracklistSchema
>;