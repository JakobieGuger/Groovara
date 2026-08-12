import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidSpotifyAccessToken } from "@/lib/spotifyServer";

export const runtime = "nodejs";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const MAX_EXPORT_SONGS = 500;

type ExportBody = {
  tracklistId?: string;
  mixlistId?: string;
};

type SourcePlatform = "spotify" | "youtube" | "apple";

type SourceSong = {
  position?: number | null;
  platform?: string | null;
  track_id?: string | null;
  title?: string | null;
  artist?: string | null;
  url?: string | null;
  isrc?: string | null;
};

type ConversionResponse = {
  status?: string;
  track?: {
    platform?: string;
    track_id?: string;
    url?: string;
  };
};

type SpotifySearchResponse = {
  tracks?: Array<{
    id?: string;
    track_id?: string;
    url?: string;
  }>;
};

type SpotifyCreatePlaylistResponse = {
  id?: string;
  external_urls?: {
    spotify?: string;
  };
  error?: {
    message?: string;
  };
};

function extractSpotifyTrackId(
  rawValue: string | null | undefined,
): string | null {
  if (!rawValue) return null;

  const value = rawValue.trim();

  const uriMatch = value.match(/^spotify:track:([A-Za-z0-9]+)$/i);
  if (uriMatch?.[1]) return uriMatch[1];

  // Spotify track IDs are normally 22 base62 characters.
  if (/^[A-Za-z0-9]{22}$/.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== "open.spotify.com") {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const trackIndex = parts.indexOf("track");
    const id = trackIndex >= 0 ? parts[trackIndex + 1] : null;

    return id && /^[A-Za-z0-9]{22}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function inferSourcePlatform(song: SourceSong): SourcePlatform | null {
  if (
    song.platform === "spotify" ||
    song.platform === "youtube" ||
    song.platform === "apple"
  ) {
    return song.platform;
  }

  const value = (song.url ?? "").toLowerCase();

  if (value.includes("spotify.com")) return "spotify";

  if (
    value.includes("youtube.com") ||
    value.includes("youtu.be")
  ) {
    return "youtube";
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

async function searchSpotify(
  request: NextRequest,
  song: SourceSong,
): Promise<string | null> {
  const query = [song.title, song.artist]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!query) return null;

  const url = new URL(
    "/api/spotify/search",
    request.nextUrl.origin,
  );
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Spotify fallback search failed", {
      status: response.status,
      title: song.title,
      artist: song.artist,
    });
    return null;
  }

  const payload =
    await parseJsonSafely<SpotifySearchResponse>(response);

  const first = payload?.tracks?.[0];

  return (
    extractSpotifyTrackId(first?.track_id) ??
    extractSpotifyTrackId(first?.id) ??
    extractSpotifyTrackId(first?.url)
  );
}

async function resolveSpotifyTrackId(
  request: NextRequest,
  song: SourceSong,
): Promise<string | null> {
  const direct =
    extractSpotifyTrackId(song.track_id) ??
    extractSpotifyTrackId(song.url);

  if (direct) return direct;

  const sourcePlatform = inferSourcePlatform(song);

  if (!sourcePlatform || sourcePlatform === "spotify") {
    return searchSpotify(request, song);
  }

  // Use Groovara's existing conversion/cache layer first so known
  // cross-platform matches are reused.
  try {
    const response = await fetch(
      new URL("/api/convert", request.nextUrl.origin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePlatform,
          sourceUrl: song.url ?? "",
          sourceTitle: song.title ?? "Unknown title",
          sourceArtist: song.artist ?? "Unknown artist",
          sourceIsrc: song.isrc ?? null,
          targetPlatform: "spotify",
          allowSearch: true,
        }),
        cache: "no-store",
      },
    );

    const payload =
      await parseJsonSafely<ConversionResponse>(response);

    const converted =
      extractSpotifyTrackId(payload?.track?.track_id) ??
      extractSpotifyTrackId(payload?.track?.url);

    if (response.ok && converted) {
      return converted;
    }
  } catch (error) {
    console.error("Groovara Spotify conversion failed", {
      title: song.title,
      artist: song.artist,
      error,
    });
  }

  // A stale conversion-cache error should not kill the export.
  return searchSpotify(request, song);
}

function spotifyApiError(
  status: number,
  fallback: string,
) {
  if (status === 401 || status === 403) {
    return "Spotify authorization needs to be refreshed. Reconnect Spotify and try again.";
  }

  if (status === 429) {
    return "Spotify is rate limiting exports right now. Try again shortly.";
  }

  return fallback;
}

export async function POST(request: NextRequest) {
  const body =
    (await request.json().catch(() => null)) as ExportBody | null;

  if (!body?.tracklistId && !body?.mixlistId) {
    return NextResponse.json(
      { error: "Missing tracklistId or mixlistId." },
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
        error: "Sign in to export to Spotify.",
        code: "not_authenticated",
      },
      { status: 401 },
    );
  }

  let playlistSourceTitle = "Mixlist";
  let songs: SourceSong[] = [];

  if (body.tracklistId) {
    const { data: tracklist, error: tracklistError } =
      await supabase
        .from("tracklists")
        .select("id,title,user_id")
        .eq("id", body.tracklistId)
        .maybeSingle();

    if (tracklistError || !tracklist) {
      return NextResponse.json(
        { error: "Tracklist not found." },
        { status: 404 },
      );
    }

    if (tracklist.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 },
      );
    }

    playlistSourceTitle =
      tracklist.title?.trim() || "Tracklist";

    const { data, error } = await supabase
      .from("tracklist_songs")
      .select(
        "position,platform,track_id,title,artist,url,isrc",
      )
      .eq("tracklist_id", body.tracklistId)
      .order("position", { ascending: true });

    if (error) {
      console.error(
        "Failed to load Tracklist songs for Spotify export",
        error,
      );
      return NextResponse.json(
        { error: "Failed to load Tracklist songs." },
        { status: 500 },
      );
    }

    songs = (data ?? []) as SourceSong[];
  } else if (body.mixlistId) {
    const { data: mixlist, error: mixlistError } =
      await supabase
        .from("mixlists")
        .select("id,title")
        .eq("id", body.mixlistId)
        .maybeSingle();

    if (mixlistError || !mixlist) {
      return NextResponse.json(
        { error: "Mixlist not found." },
        { status: 404 },
      );
    }

    playlistSourceTitle =
      mixlist.title?.trim() || "Mixlist";

    const { data, error } = await supabase
      .from("mixlist_songs")
      .select(
        "position,platform,track_id,title,artist,url,isrc",
      )
      .eq("mixlist_id", body.mixlistId)
      .order("position", { ascending: true });

    if (error) {
      console.error(
        "Failed to load Mixlist songs for Spotify export",
        error,
      );
      return NextResponse.json(
        { error: "Failed to load Mixlist songs." },
        { status: 500 },
      );
    }

    songs = (data ?? []) as SourceSong[];
  }

  if (songs.length === 0) {
    return NextResponse.json(
      { error: "This list has no songs to export." },
      { status: 400 },
    );
  }

  if (songs.length > MAX_EXPORT_SONGS) {
    return NextResponse.json(
      {
        error:
          `Spotify exports are limited to ${MAX_EXPORT_SONGS} songs.`,
      },
      { status: 400 },
    );
  }

  const spotifyUris: string[] = [];
  let unresolvedCount = 0;

  for (const song of songs) {
    try {
      const spotifyTrackId =
        await resolveSpotifyTrackId(request, song);

      if (!spotifyTrackId) {
        unresolvedCount += 1;
        continue;
      }

      spotifyUris.push(
        `spotify:track:${spotifyTrackId}`,
      );
    } catch (error) {
      unresolvedCount += 1;
      console.error("Spotify song resolution crashed", {
        title: song.title,
        artist: song.artist,
        error,
      });
    }
  }

  if (spotifyUris.length === 0) {
    return NextResponse.json(
      {
        error:
          "Groovara could not find Spotify matches for any songs in this list.",
        code: "spotify_matches_not_found",
        unresolvedCount,
      },
      { status: 400 },
    );
  }

  let accessToken: string;

  try {
    accessToken =
      await getValidSpotifyAccessToken({
        supabase,
        userId: user.id,
      });
  } catch (error) {
    console.error(
      "Failed to obtain Spotify access token",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Spotify needs to be connected before you can export.",
        code: "spotify_reconnect_required",
        connectUrl: "/api/spotify/login",
      },
      { status: 409 },
    );
  }

  // Spotify removed POST /users/{user_id}/playlists in February 2026.
  // Current endpoint: POST /me/playlists.
  const createResponse = await fetch(
    `${SPOTIFY_API_BASE}/me/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Groovara: ${playlistSourceTitle}`,
        description: "Exported from Groovara",
        public: false,
      }),
      cache: "no-store",
    },
  );

  const created =
    await parseJsonSafely<SpotifyCreatePlaylistResponse>(
      createResponse,
    );

  if (!createResponse.ok || !created?.id) {
    const message = spotifyApiError(
      createResponse.status,
      created?.error?.message ??
        "Spotify could not create the playlist.",
    );

    console.error("Spotify playlist creation failed", {
      status: createResponse.status,
      message,
    });

    return NextResponse.json(
      {
        error: message,
        code: "spotify_playlist_create_failed",
        connectUrl:
          createResponse.status === 401 ||
          createResponse.status === 403
            ? "/api/spotify/login"
            : undefined,
      },
      {
        status:
          createResponse.status === 401 ||
          createResponse.status === 403
            ? 409
            : createResponse.status === 429
              ? 429
              : 502,
      },
    );
  }

  const playlistId = created.id;

  // Spotify removed POST /playlists/{id}/tracks in February 2026.
  // Current endpoint: POST /playlists/{id}/items.
  for (
    let index = 0;
    index < spotifyUris.length;
    index += 100
  ) {
    const batch = spotifyUris.slice(index, index + 100);

    const addResponse = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(
        playlistId,
      )}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: batch }),
        cache: "no-store",
      },
    );

    if (!addResponse.ok) {
      const payload =
        await parseJsonSafely<{
          error?: { message?: string };
        }>(addResponse);

      const message = spotifyApiError(
        addResponse.status,
        payload?.error?.message ??
          "Spotify could not add songs to the playlist.",
      );

      console.error(
        "Spotify playlist item insertion failed",
        {
          status: addResponse.status,
          added: index,
          total: spotifyUris.length,
          message,
        },
      );

      return NextResponse.json(
        {
          error: message,
          code: "spotify_playlist_items_failed",
          partial: index > 0,
          playlistId,
          playlistUrl:
            created.external_urls?.spotify ?? null,
          exportedCount: index,
          skippedCount:
            unresolvedCount +
            (spotifyUris.length - index),
          connectUrl:
            addResponse.status === 401 ||
            addResponse.status === 403
              ? "/api/spotify/login"
              : undefined,
        },
        {
          status:
            addResponse.status === 401 ||
            addResponse.status === 403
              ? 409
              : addResponse.status === 429
                ? 429
                : 502,
        },
      );
    }
  }

  return NextResponse.json({
    success: true,
    playlistId,
    playlistUrl:
      created.external_urls?.spotify ??
      `https://open.spotify.com/playlist/${encodeURIComponent(
        playlistId,
      )}`,
    exportedCount: spotifyUris.length,
    skippedCount: unresolvedCount,
  });
}
