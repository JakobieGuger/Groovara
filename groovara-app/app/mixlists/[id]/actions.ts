"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const copyMixlistSchema = z.object({
  mixlistId: z.string().uuid("Invalid Mixlist id."),
});

type CopyMixlistToStudioResult =
  | { ok: true; tracklistId: string }
  | { ok: false; message: string };

type MixlistSongRow = {
  id: string;
  position: number | null;
  platform: string | null;
  track_id: string | null;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  note: string | null;
};

function inferPlatform(url: string): string {
  const value = url.toLowerCase();

  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return "youtube";
  }

  if (value.includes("spotify.com")) {
    return "spotify";
  }

  if (value.includes("music.apple.com") || value.includes("itunes.apple.com")) {
    return "apple";
  }

  return "other";
}

export async function copyMixlistToStudioAction(
  rawInput: unknown
): Promise<CopyMixlistToStudioResult> {
  const parsed = copyMixlistSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid Mixlist.",
    };
  }

  const { mixlistId } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      message: "Sign in to copy this Mixlist into your Studio.",
    };
  }

  const { data: mixlist, error: mixlistError } = await supabase
    .from("mixlists")
    .select("id,title")
    .eq("id", mixlistId)
    .maybeSingle();

  if (mixlistError) {
    return {
      ok: false,
      message: mixlistError.message ?? "Could not load this Mixlist.",
    };
  }

  if (!mixlist) {
    return {
      ok: false,
      message: "This Mixlist could not be found or is no longer available.",
    };
  }

  const { data: songData, error: songError } = await supabase
    .from("mixlist_songs")
    .select("id,position,platform,track_id,title,artist,album,url,note")
    .eq("mixlist_id", mixlistId)
    .order("position", { ascending: true });

  if (songError) {
    return {
      ok: false,
      message: songError.message ?? "Could not copy the Mixlist songs.",
    };
  }

  const baseTitle = (mixlist.title?.trim() || "Untitled Mixlist").slice(0, 105);
  const studioTitle = `${baseTitle} (Studio Copy)`;
  const now = new Date().toISOString();

  const { data: tracklist, error: tracklistError } = await supabase
    .from("tracklists")
    .insert({
      user_id: user.id,
      title: studioTitle,
      description: null,
      status: "draft",
      updated_at: now,
    })
    .select("id")
    .single();

  if (tracklistError || !tracklist) {
    return {
      ok: false,
      message: tracklistError?.message ?? "Could not create the Studio draft.",
    };
  }

  const songs = (songData ?? []) as MixlistSongRow[];

  if (songs.length > 0) {
    const payload = songs.map((song, index) => ({
      tracklist_id: tracklist.id,
      position: index,
      platform: song.platform?.trim() || inferPlatform(song.url),
      track_id: song.track_id?.trim() || song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      version: null,
      url: song.url,
      note: song.note,
    }));

    const { error: insertSongsError } = await supabase
      .from("tracklist_songs")
      .insert(payload);

    if (insertSongsError) {
      await supabase.from("tracklists").delete().eq("id", tracklist.id);

      return {
        ok: false,
        message:
          insertSongsError.message ??
          "The Studio draft was created, but its songs could not be copied.",
      };
    }
  }

  revalidatePath("/tracklists");
  revalidatePath(`/tracklists/${tracklist.id}`);

  return {
    ok: true,
    tracklistId: tracklist.id,
  };
}
