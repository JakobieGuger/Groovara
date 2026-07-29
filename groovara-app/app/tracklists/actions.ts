"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import { writeAuditLog } from "@/lib/security/auditLog";

const deleteTracklistSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
});

const importedPlatformTrackSchema = z.object({
  platform: z.enum(["spotify", "youtube", "apple"]),
  track_id: z.string().trim().min(1, "Track ID is required."),
  title: z.string().trim().min(1, "Song title is required.").max(300),
  artist: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? "Unknown Artist" : trimmed;
    },
    z.string().max(200).default("Unknown Artist"),
  ),
  album: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(200).nullable().default(null),
  ),
  url: z.string().trim().url("URL must be valid.").max(2048),
});

const importPlatformTracklistSchema = z.object({
  playlistName: z
    .string()
    .trim()
    .min(1, "Playlist name is required.")
    .max(120, "Playlist name must be 120 characters or fewer."),
  playlistDescription: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(1000).nullable().default(null),
  ),
  tracks: z
    .array(importedPlatformTrackSchema)
    .min(1, "At least one track is required."),
});

type DeleteTracklistResult =
  | { ok: true }
  | {
      ok: false;
      type: "validation";
      fieldErrors: Record<string, string[] | undefined>;
      formErrors: string[];
    }
  | {
      ok: false;
      type: "auth" | "db" | "not_found" | "rate_limit";
      message: string;
      resetAtIso?: string;
    };

type ImportPlatformTracklistResult =
  | { ok: true; tracklistId: string }
  | {
      ok: false;
      type: "validation";
      fieldErrors: Record<string, string[] | undefined>;
      formErrors: string[];
    }
  | {
      ok: false;
      type: "auth" | "db" | "rate_limit";
      message: string;
      resetAtIso?: string;
    };

export async function deleteTracklistAction(
  rawInput: unknown,
): Promise<DeleteTracklistResult> {
  const parsed = deleteTracklistSchema.safeParse(rawInput);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      ok: false,
      type: "validation",
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    };
  }

  const { tracklistId } = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      type: "auth",
      message: "You must be logged in to delete a tracklist.",
    };
  }

  const rateLimit = await enforceRateLimit({
    action: "delete_tracklist",
    ...RATE_LIMITS.delete_tracklist,
    metadata: {
      source: "app/tracklists/actions.ts",
      tracklistId,
    },
  });

  if (!rateLimit.ok) {
    return {
      ok: false,
      type: "rate_limit",
      message: rateLimit.message,
      resetAtIso: rateLimit.resetAtIso,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("tracklists")
    .select("id,user_id")
    .eq("id", tracklistId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      type: "db",
      message: existingError.message ?? "Failed to verify tracklist ownership.",
    };
  }

  if (!existing) {
    return {
      ok: false,
      type: "not_found",
      message: "Tracklist not found or you do not have access to it.",
    };
  }

  await writeAuditLog({
    eventType: "tracklist_delete",
    userId: user.id,
    resourceType: "tracklist",
    resourceId: tracklistId,
    success: true,
    metadata: {
      source: "app/tracklists/actions.ts",
    },
  });

  const { error: childError } = await supabase
    .from("tracklist_songs")
    .delete()
    .eq("tracklist_id", tracklistId);

  if (childError) {
    return {
      ok: false,
      type: "db",
      message: childError.message ?? "Failed to delete tracklist songs.",
    };
  }

  const { error } = await supabase
    .from("tracklists")
    .delete()
    .eq("id", tracklistId);

  if (error) {
    return {
      ok: false,
      type: "db",
      message: error.message ?? "Failed to delete tracklist.",
    };
  }

  revalidatePath("/hub");
  revalidatePath(`/tracklists/${tracklistId}`);

  return { ok: true };
}

export async function importPlatformTracklistAction(
  rawInput: unknown,
): Promise<ImportPlatformTracklistResult> {
  const parsed = importPlatformTracklistSchema.safeParse(rawInput);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      ok: false,
      type: "validation",
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    };
  }

  const input = parsed.data;
  const primaryPlatform = input.tracks[0]?.platform ?? "unknown";
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      type: "auth",
      message: "You must be logged in to import a playlist.",
    };
  }

  // Reuse the existing import limiter so this patch does not require changes
  // to the rate-limit action/type config yet. Metadata still records platform.
  const rateLimit = await enforceRateLimit({
    action: "spotify_import",
    ...RATE_LIMITS.spotify_import,
    metadata: {
      source: "app/tracklists/actions.ts",
      platform: primaryPlatform,
      trackCount: input.tracks.length,
      playlistName: input.playlistName,
    },
  });

  if (!rateLimit.ok) {
    return {
      ok: false,
      type: "rate_limit",
      message: rateLimit.message,
      resetAtIso: rateLimit.resetAtIso,
    };
  }

  const { data: tracklist, error: tracklistError } = await supabase
    .from("tracklists")
    .insert({
      user_id: user.id,
      title: input.playlistName,
      description: input.playlistDescription,
      status: "draft",
    })
    .select("id")
    .single();

  if (tracklistError || !tracklist) {
    return {
      ok: false,
      type: "db",
      message: tracklistError?.message ?? "Failed to create imported tracklist.",
    };
  }

  const rows = input.tracks.map((track, idx) => ({
    tracklist_id: tracklist.id,
    position: idx,
    platform: track.platform,
    track_id: track.track_id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    url: track.url,
    note: null,
    version: null,
  }));

  const { error: songsError } = await supabase
    .from("tracklist_songs")
    .insert(rows);

  if (songsError) {
    return {
      ok: false,
      type: "db",
      message: songsError.message ?? "Failed to import playlist songs.",
    };
  }

  revalidatePath("/hub");
  revalidatePath(`/tracklists/${tracklist.id}`);

  return { ok: true, tracklistId: tracklist.id };
}

// Backward-compatible export so the current /tracklists page can keep importing
// importSpotifyTracklistAction while the action itself now accepts all platforms.
export async function importSpotifyTracklistAction(
  rawInput: unknown,
): Promise<ImportPlatformTracklistResult> {
  return importPlatformTracklistAction(rawInput);
}