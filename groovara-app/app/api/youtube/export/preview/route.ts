import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getYouTubeSearchBudgetStatus } from "@/lib/youtubeSearchBudget";

export const runtime = "nodejs";

const MAX_PREVIEW_SONGS = 200;

type PreviewBody = {
  mixlistId?: string;
};

type SourcePlatform = "spotify" | "youtube" | "apple";

type MixlistSong = {
  position: number | null;
  platform: string | null;
  track_id: string | null;
  title: string | null;
  artist: string | null;
  url: string | null;
  isrc: string | null;
};

type ConversionResponse = {
  cached?: boolean;
  globalCached?: boolean;
  matchMethod?: "isrc" | "title_artist";
  status?: string;
  searchRequired?: boolean;
  track?: {
    platform?: string;
    track_id?: string;
    url?: string;
  };
};

type PreviewSongStatus =
  | "matched"
  | "search_required"
  | "unresolved";

type PreviewSong = {
  position: number;
  title: string;
  artist: string;
  status: PreviewSongStatus;
  matchSource:
    | "direct_youtube"
    | "source_url_cache"
    | "isrc"
    | "title_artist"
    | null;
};

type ResolvePreviewResult = {
  status: PreviewSongStatus;
  videoId: string | null;
  matchSource: PreviewSong["matchSource"];
};

function extractYouTubeId(
  rawUrlOrId: string | null | undefined,
): string | null {
  if (!rawUrlOrId) return null;

  const trimmed = rawUrlOrId.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id)
        ? id
        : null;
    }

    const isYouTubeHost =
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com");

    if (!isYouTubeHost) return null;

    const watchId = parsed.searchParams.get("v");

    if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) {
      return watchId;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);

    for (const marker of ["shorts", "embed", "live"] as const) {
      const markerIndex = parts.indexOf(marker);
      if (markerIndex === -1) continue;

      const id = parts[markerIndex + 1] ?? null;

      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function inferSourcePlatform(
  song: MixlistSong,
): SourcePlatform | null {
  if (
    song.platform === "spotify" ||
    song.platform === "youtube" ||
    song.platform === "apple"
  ) {
    return song.platform;
  }

  const value = (song.url ?? "").toLowerCase();

  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return "youtube";
  }

  if (value.includes("spotify.com")) {
    return "spotify";
  }

  if (
    value.includes("music.apple.com") ||
    value.includes("itunes.apple.com")
  ) {
    return "apple";
  }

  return null;
}

async function parseJsonSafely<T>(
  response: Response,
): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function resolveSongFromCache(options: {
  request: NextRequest;
  song: MixlistSong;
}): Promise<ResolvePreviewResult> {
  const directVideoId =
    extractYouTubeId(options.song.track_id) ??
    extractYouTubeId(options.song.url);

  if (directVideoId) {
    return {
      status: "matched",
      videoId: directVideoId,
      matchSource: "direct_youtube",
    };
  }

  const sourcePlatform = inferSourcePlatform(options.song);

  if (!sourcePlatform || sourcePlatform === "youtube") {
    return {
      status: "unresolved",
      videoId: null,
      matchSource: null,
    };
  }

  const response = await fetch(
    new URL("/api/convert", options.request.nextUrl.origin),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourcePlatform,
        sourceUrl: options.song.url ?? "",
        sourceTitle: options.song.title ?? "Unknown title",
        sourceArtist: options.song.artist ?? "Unknown artist",
        sourceIsrc: options.song.isrc ?? null,
        targetPlatform: "youtube",
        allowSearch: false,
      }),
      cache: "no-store",
    },
  );

  const payload =
    await parseJsonSafely<ConversionResponse>(response);

  if (
    payload?.status === "search_required" ||
    payload?.searchRequired === true
  ) {
    return {
      status: "search_required",
      videoId: null,
      matchSource: null,
    };
  }

  const videoId =
    extractYouTubeId(payload?.track?.track_id) ??
    extractYouTubeId(payload?.track?.url);

  if (response.ok && videoId) {
    const matchSource: PreviewSong["matchSource"] =
      payload?.globalCached === true
        ? payload.matchMethod === "isrc"
          ? "isrc"
          : "title_artist"
        : "source_url_cache";

    return {
      status: "matched",
      videoId,
      matchSource,
    };
  }

  return {
    status: "unresolved",
    videoId: null,
    matchSource: null,
  };
}

export async function POST(request: NextRequest) {
  const body =
    (await request.json().catch(() => null)) as PreviewBody | null;
  const mixlistId = String(body?.mixlistId ?? "").trim();

  if (!mixlistId) {
    return NextResponse.json(
      { error: "Missing mixlistId." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Sign in to preview a YouTube export.",
        code: "not_authenticated",
      },
      { status: 401 },
    );
  }

  const { data: mixlist, error: mixlistError } = await supabase
    .from("mixlists")
    .select("id,title")
    .eq("id", mixlistId)
    .maybeSingle<{ id: string; title: string | null }>();

  if (mixlistError || !mixlist) {
    return NextResponse.json(
      { error: "Mixlist not found or unavailable." },
      { status: 404 },
    );
  }

  const { data: songRows, error: songsError } = await supabase
    .from("mixlist_songs")
    .select(
      "position,platform,track_id,title,artist,url,isrc",
    )
    .eq("mixlist_id", mixlistId)
    .order("position", { ascending: true });

  if (songsError) {
    console.error(
      "Failed to load Mixlist songs for YouTube preview",
      songsError,
    );

    return NextResponse.json(
      { error: "Failed to load Mixlist songs." },
      { status: 500 },
    );
  }

  const songs = (songRows ?? []) as MixlistSong[];

  if (songs.length === 0) {
    return NextResponse.json(
      { error: "This Mixlist has no songs to export." },
      { status: 400 },
    );
  }

  if (songs.length > MAX_PREVIEW_SONGS) {
    return NextResponse.json(
      {
        error:
          `YouTube previews are limited to ${MAX_PREVIEW_SONGS} songs.`,
      },
      { status: 400 },
    );
  }

  const resolutionCache =
    new Map<string, ResolvePreviewResult>();
  const previewSongs: PreviewSong[] = [];

  let matchedCount = 0;
  let searchRequiredCount = 0;
  let unresolvedCount = 0;

  for (const [index, song] of songs.entries()) {
    const cacheKey = [
      song.isrc,
      song.url,
      song.title,
      song.artist,
    ].join("\u0000");

    let result = resolutionCache.get(cacheKey);

    if (!result) {
      try {
        result = await resolveSongFromCache({
          request,
          song,
        });
      } catch (error) {
        console.error("YouTube export preview resolution failed", {
          title: song.title,
          artist: song.artist,
          error,
        });

        result = {
          status: "unresolved",
          videoId: null,
          matchSource: null,
        };
      }

      resolutionCache.set(cacheKey, result);
    }

    if (result.status === "matched") {
      matchedCount += 1;
    } else if (result.status === "search_required") {
      searchRequiredCount += 1;
    } else {
      unresolvedCount += 1;
    }

    previewSongs.push({
      position:
        Number.isInteger(song.position)
          ? Number(song.position)
          : index + 1,
      title: song.title?.trim() || "Unknown title",
      artist: song.artist?.trim() || "Unknown artist",
      status: result.status,
      matchSource: result.matchSource,
    });
  }

  let budget;
  try {
    budget = await getYouTubeSearchBudgetStatus();
  } catch (error) {
    console.error("Failed to load YouTube search budget", error);

    return NextResponse.json(
      {
        error: "Failed to read the YouTube search budget.",
        code: "youtube_search_budget_unavailable",
      },
      { status: 500 },
    );
  }

  const uniqueSearchRequiredCount = [
    ...new Set(
      songs
        .filter((_, index) =>
          previewSongs[index]?.status === "search_required",
        )
        .map((song) =>
          [
            song.isrc,
            song.url,
            song.title,
            song.artist,
          ].join("\u0000"),
        ),
    ),
  ].length;

  const estimatedGeneralQuotaUnits =
    50 +
    songs.length * 50 +
    Math.max(1, Math.ceil(songs.length / 50));

  return NextResponse.json({
    success: true,
    mixlistId,
    title: mixlist.title ?? "Mixlist",
    songCount: songs.length,
    matchedCount,
    searchRequiredCount,
    uniqueSearchRequiredCount,
    unresolvedCount,
    estimatedSearchRequests: uniqueSearchRequiredCount,
    estimatedGeneralQuotaUnits,
    canSearchAndExport:
      uniqueSearchRequiredCount <= budget.remaining,
    canExportMatchedOnly: matchedCount > 0,
    budget,
    songs: previewSongs,
  });
}
