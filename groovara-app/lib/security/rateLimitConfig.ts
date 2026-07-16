import type { RateLimitAction } from "./rateLimit";

export const RATE_LIMITS: Record<
  RateLimitAction,
  { maxAttempts: number; windowSeconds: number }
> = {
  create_tracklist: { maxAttempts: 10, windowSeconds: 60 * 60 },
  create_mixlist: { maxAttempts: 20, windowSeconds: 60 * 60 },
  add_song: { maxAttempts: 120, windowSeconds: 60 * 60 },
  manual_add_song: { maxAttempts: 120, windowSeconds: 60 * 60 },
  save_note: { maxAttempts: 60, windowSeconds: 10 * 60 },
  bulk_update_notes: { maxAttempts: 60, windowSeconds: 10 * 60 },
  save_settings: { maxAttempts: 20, windowSeconds: 60 * 60 },
  delete_tracklist: { maxAttempts: 20, windowSeconds: 60 * 60 },
  delete_mixlist: { maxAttempts: 20, windowSeconds: 60 * 60 },
  spotify_import: { maxAttempts: 10, windowSeconds: 60 * 60 },
  youtube_export: { maxAttempts: 55, windowSeconds: 60 * 60 },
  submit_feedback: { maxAttempts: 2, windowSeconds: 60 * 5 },
};
