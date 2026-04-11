"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createMixlistFromTracklistSchema,
  type CreateMixlistFromTracklistInput,
} from "@/lib/validation/mixlists";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import { writeAuditLog } from "@/lib/security/auditLog";

type ValidationResult =
  | {
      ok: false;
      type: "validation";
      fieldErrors: Record<string, string[] | undefined>;
      formErrors: string[];
    }
  | { ok: false; type: "auth" | "db" | "rate_limit" | "not_found"; message: string; resetAtIso?: string };

type OkResult = { ok: true };
type MixlistActionResult = { ok: true; mixlistId: string } | ValidationResult;

function validationFailure(error: z.ZodError): ValidationResult {
  const flattened = error.flatten();
  return {
    ok: false,
    type: "validation",
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };
}

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

async function verifyTracklistOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tracklistId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("tracklists")
    .select("id,user_id")
    .eq("id", tracklistId)
    .eq("user_id", userId)
    .maybeSingle();

  return { data, error };
}

async function verifySongOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tracklistId: string,
  songId: string
) {
  const { data, error } = await supabase
    .from("tracklist_songs")
    .select("id,tracklist_id,position")
    .eq("id", songId)
    .eq("tracklist_id", tracklistId)
    .maybeSingle();

  return { data, error };
}

async function reindexTracklistSongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tracklistId: string
) {
  const { data, error } = await supabase
    .from("tracklist_songs")
    .select("id,position")
    .eq("tracklist_id", tracklistId)
    .order("position", { ascending: true });

  if (error) return { error };

  for (const [index, row] of (data ?? []).entries()) {
    const { error: updateError } = await supabase
      .from("tracklist_songs")
      .update({ position: index })
      .eq("id", row.id);
    if (updateError) return { error: updateError };
  }

  return { error: null };
}

const updateTracklistMetadataSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
  title: z.string().trim().min(1, "Title is required.").max(120),
  description: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(1000).nullable()
  ),
});

const trackSongSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
  platform: z.string().trim().min(1).max(50),
  track_id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().min(1).max(200),
  album: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(200).nullable()
  ),
  url: z.string().trim().url("URL must be valid.").max(2048),
});

const removeSongSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
  songId: z.string().uuid("Invalid song id."),
});

const moveSongSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
  songId: z.string().uuid("Invalid song id."),
  direction: z.enum(["up", "down"]),
});

const saveSingleNoteSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
  songId: z.string().uuid("Invalid song id."),
  note: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(500).nullable()
  ),
});

const multiNoteSchema = z.object({
  tracklistId: z.string().uuid("Invalid tracklist id."),
  songIds: z.array(z.string().uuid("Invalid song id.")).min(1, "Select at least one song."),
  note: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(500).nullable()
  ),
});

export async function createMixlistFromTracklistAction(
  rawInput: unknown
): Promise<MixlistActionResult> {
  const parsed = createMixlistFromTracklistSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const input: CreateMixlistFromTracklistInput = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: ownedTracklist, error: ownErr } = await verifyTracklistOwnership(
    supabase,
    input.source_tracklist_id,
    user.id
  );

  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }

  if (!ownedTracklist) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

    const rateLimit = await enforceRateLimit({
      action: "create_mixlist",
      ...RATE_LIMITS.create_mixlist,
      metadata: {
        source: "app/tracklists/[id]/actions.ts",
        sourceTracklistId: input.source_tracklist_id,
        songCount: input.songs.length,
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

  const { data: mix, error: mixErr } = await supabase
    .from("mixlists")
    .insert({
      owner_user_id: user.id,
      title: input.title,
      source_tracklist_id: input.source_tracklist_id,
      message: input.message,
      reveal_mode: input.reveal_mode,
      is_public: input.is_public,
      finishing_note: input.finishing_note,
      include_song_notes: input.include_song_notes,
    })
    .select("id")
    .single();

  if (mixErr || !mix) {
    return {
      ok: false,
      type: "db",
      message: mixErr?.message ?? "Failed to create mixlist.",
    };
  }

  await writeAuditLog({
    eventType: "mixlist_create",
    userId: user.id,
    resourceType: "mixlist",
    resourceId: mix.id,
    success: true,
    metadata: {
      sourceTracklistId: input.source_tracklist_id,
      songCount: input.songs.length,
      source: "app/tracklists/[id]/actions.ts",
    },
  });

  const payload = input.songs
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s, i) => ({
      mixlist_id: mix.id,
      position: i + 1,
      platform: s.platform,
      track_id: s.track_id,
      title: s.title,
      artist: s.artist,
      album: s.album,
      version: null,
      url: s.url,
      note: s.note,
    }));

  const { error: snapErr } = await supabase.from("mixlist_songs").insert(payload);

  if (snapErr) {
    return {
      ok: false,
      type: "db",
      message: snapErr.message ?? "Failed to snapshot songs into the mixlist.",
    };
  }

  revalidatePath("/mixlists");
  revalidatePath(`/mixlists/${mix.id}`);

  return { ok: true, mixlistId: mix.id };
}

export async function updateTracklistMetadataAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = updateTracklistMetadataSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { tracklistId, title, description } = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: owned, error: ownErr } = await verifyTracklistOwnership(supabase, tracklistId, user.id);
  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }
  if (!owned) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

  const { error } = await supabase
    .from("tracklists")
    .update({ title, description })
    .eq("id", tracklistId);

  if (error) {
    return { ok: false, type: "db", message: error.message ?? "Failed to save tracklist." };
  }

  revalidatePath("/tracklists");
  revalidatePath(`/tracklists/${tracklistId}`);

  return { ok: true };
}

export async function addSongToTracklistAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = trackSongSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const input = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: owned, error: ownErr } = await verifyTracklistOwnership(supabase, input.tracklistId, user.id);
  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }
  if (!owned) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

  const rateLimit = await enforceRateLimit({
    action: "add_song",
    ...RATE_LIMITS.add_song,
    metadata: {
      source: "app/tracklists/[id]/actions.ts",
      tracklistId: input.tracklistId,
      platform: input.platform,
      trackId: input.track_id,
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

  const { data: existingSongs, error: loadError } = await supabase
    .from("tracklist_songs")
    .select("position")
    .eq("tracklist_id", input.tracklistId)
    .order("position", { ascending: false })
    .limit(1);

  if (loadError) {
    return { ok: false, type: "db", message: loadError.message ?? "Failed to determine next position." };
  }

  const nextPos = existingSongs && existingSongs.length > 0 ? (existingSongs[0].position ?? 0) + 1 : 0;

  const { error } = await supabase.from("tracklist_songs").insert({
    tracklist_id: input.tracklistId,
    position: nextPos,
    platform: input.platform,
    track_id: input.track_id,
    title: input.title,
    artist: input.artist,
    album: input.album,
    version: null,
    url: input.url,
    note: null,
  });

  if (error) {
    return { ok: false, type: "db", message: error.message ?? "Failed to add song." };
  }

  revalidatePath(`/tracklists/${input.tracklistId}`);
  return { ok: true };
}

export async function addManualSongToTracklistAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  return addSongToTracklistAction(rawInput);
}

export async function removeSongFromTracklistAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = removeSongSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { tracklistId, songId } = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: owned, error: ownErr } = await verifyTracklistOwnership(supabase, tracklistId, user.id);
  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }
  if (!owned) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

  const { data: song, error: songErr } = await verifySongOwnership(supabase, tracklistId, songId);
  if (songErr) {
    return { ok: false, type: "db", message: songErr.message ?? "Failed to verify song ownership." };
  }
  if (!song) {
    return { ok: false, type: "not_found", message: "Song not found in this tracklist." };
  }

  const { error } = await supabase.from("tracklist_songs").delete().eq("id", songId);

  if (error) {
    return { ok: false, type: "db", message: error.message ?? "Failed to remove song." };
  }

  const { error: reindexError } = await reindexTracklistSongs(supabase, tracklistId);
  if (reindexError) {
    return { ok: false, type: "db", message: reindexError.message ?? "Failed to normalize song positions." };
  }

  revalidatePath(`/tracklists/${tracklistId}`);
  return { ok: true };
}

export async function moveTracklistSongAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = moveSongSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { tracklistId, songId, direction } = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: owned, error: ownErr } = await verifyTracklistOwnership(supabase, tracklistId, user.id);
  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }
  if (!owned) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

  const { data: songs, error: loadError } = await supabase
    .from("tracklist_songs")
    .select("id,position")
    .eq("tracklist_id", tracklistId)
    .order("position", { ascending: true });

  if (loadError) {
    return { ok: false, type: "db", message: loadError.message ?? "Failed to load song ordering." };
  }

  const idx = (songs ?? []).findIndex((s) => s.id === songId);
  if (idx === -1) {
    return { ok: false, type: "not_found", message: "Song not found in this tracklist." };
  }

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= (songs ?? []).length) {
    return { ok: true };
  }

  const a = songs![idx];
  const b = songs![targetIdx];

  const { error: e1 } = await supabase
    .from("tracklist_songs")
    .update({ position: b.position })
    .eq("id", a.id);

  if (e1) {
    return { ok: false, type: "db", message: e1.message ?? "Failed to reorder songs." };
  }

  const { error: e2 } = await supabase
    .from("tracklist_songs")
    .update({ position: a.position })
    .eq("id", b.id);

  if (e2) {
    return { ok: false, type: "db", message: e2.message ?? "Failed to reorder songs." };
  }

  revalidatePath(`/tracklists/${tracklistId}`);
  return { ok: true };
}

export async function saveTracklistSongNoteAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = saveSingleNoteSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { tracklistId, songId, note } = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: owned, error: ownErr } = await verifyTracklistOwnership(supabase, tracklistId, user.id);
  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }
  if (!owned) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

  const rateLimit = await enforceRateLimit({
    action: "save_note",
    ...RATE_LIMITS.save_note,
    metadata: {
      source: "app/tracklists/[id]/actions.ts",
      tracklistId,
      songId,
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

  const { data: song, error: songErr } = await verifySongOwnership(supabase, tracklistId, songId);
  if (songErr) {
    return { ok: false, type: "db", message: songErr.message ?? "Failed to verify song ownership." };
  }
  if (!song) {
    return { ok: false, type: "not_found", message: "Song not found in this tracklist." };
  }

  const { error } = await supabase
    .from("tracklist_songs")
    .update({ note })
    .eq("id", songId);

  if (error) {
    return { ok: false, type: "db", message: error.message ?? "Failed to save note." };
  }

  revalidatePath(`/tracklists/${tracklistId}`);
  return { ok: true };
}

export async function clearTracklistSongNoteAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = saveSingleNoteSchema.safeParse({ ...(rawInput as Record<string, unknown>), note: null });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  return saveTracklistSongNoteAction(parsed.data);
}

export async function applyTracklistNoteToSelectedAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = multiNoteSchema.safeParse(rawInput);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { tracklistId, songIds, note } = parsed.data;
  const { supabase, user, error: authError } = await getAuthedUser();

  if (authError || !user) {
    return { ok: false, type: "auth", message: "Not authenticated." };
  }

  const { data: owned, error: ownErr } = await verifyTracklistOwnership(supabase, tracklistId, user.id);
  if (ownErr) {
    return { ok: false, type: "db", message: ownErr.message ?? "Failed to verify tracklist ownership." };
  }
  if (!owned) {
    return { ok: false, type: "not_found", message: "Tracklist not found or you do not have access to it." };
  }

  const rateLimit = await enforceRateLimit({
    action: "bulk_update_notes",
    ...RATE_LIMITS.bulk_update_notes,
    metadata: {
      source: "app/tracklists/[id]/actions.ts",
      tracklistId,
      selectedCount: songIds.length,
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

  const { data: rows, error: rowsErr } = await supabase
    .from("tracklist_songs")
    .select("id")
    .eq("tracklist_id", tracklistId)
    .in("id", songIds);

  if (rowsErr) {
    return { ok: false, type: "db", message: rowsErr.message ?? "Failed to verify selected songs." };
  }

  if (!rows || rows.length !== songIds.length) {
    return { ok: false, type: "not_found", message: "One or more selected songs are invalid." };
  }

  const { error } = await supabase
    .from("tracklist_songs")
    .update({ note })
    .in("id", songIds);

  if (error) {
    return { ok: false, type: "db", message: error.message ?? "Failed to apply note to selected songs." };
  }

  revalidatePath(`/tracklists/${tracklistId}`);
  return { ok: true };
}

export async function clearTracklistNoteForSelectedAction(rawInput: unknown): Promise<OkResult | ValidationResult> {
  const parsed = multiNoteSchema.safeParse({ ...(rawInput as Record<string, unknown>), note: null });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  return applyTracklistNoteToSelectedAction(parsed.data);
}
