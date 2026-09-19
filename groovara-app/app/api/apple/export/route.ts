import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppleDeveloperToken } from "@/lib/appleMusicServer";

export const runtime = "nodejs";

const APPLE_API_BASE = "https://api.music.apple.com";
const MAX_EXPORT_SONGS = 500;
const ADD_TRACK_BATCH_SIZE = 100;

type ExportBody = {
  mixlistId?: unknown;
  musicUserToken?: unknown;
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

type AppleResource<TAttributes = Record<string, unknown>> = {
  id?: string;
  type?: string;
  href?: string;
  attributes?: TAttributes;
};

type AppleError = {
  title?: string;
  detail?: string;
  code?: string;
  status?: string;
};

type AppleResponse<T = AppleResource> = {
  data?: T[];
  errors?: AppleError[];
  results?: {
    songs?: {
      data?: Array<
        AppleResource<{
          name?: string;
          artistName?: string;
          isrc?: string;
        }>
      >;
    };
  };
};

type CreatedPlaylist = AppleResource<{
  name?: string;
}>;

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
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

function extractAppleCatalogSongId(
  rawValue: string | null | undefined,
) {
  if (!rawValue) return null;

  const value = rawValue.trim();

  if (/^\d+$/.test(value)) return value;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    if (
      host !== "music.apple.com" &&
      !host.endsWith(".music.apple.com") &&
      host !== "itunes.apple.com" &&
      !host.endsWith(".itunes.apple.com")
    ) {
      return null;
    }

    const itemId = parsed.searchParams.get("i");
    if (itemId && /^\d+$/.test(itemId)) return itemId;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const songIndex = parts.indexOf("song");

    if (songIndex !== -1) {
      const finalPart = parts.at(-1);
      if (finalPart && /^\d+$/.test(finalPart)) {
        return finalPart;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeMatchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSearchCandidate(
  song: SourceSong,
  candidate: AppleResource<{
    name?: string;
    artistName?: string;
  }>,
) {
  const wantedTitle = normalizeMatchText(song.title);
  const wantedArtist = normalizeMatchText(song.artist);
  const title = normalizeMatchText(candidate.attributes?.name);
  const artist = normalizeMatchText(candidate.attributes?.artistName);

  let score = 0;

  if (wantedTitle && title === wantedTitle) score += 8;
  else if (
    wantedTitle &&
    (title.includes(wantedTitle) || wantedTitle.includes(title))
  ) {
    score += 4;
  }

  if (wantedArtist && artist === wantedArtist) score += 8;
  else if (
    wantedArtist &&
    (artist.includes(wantedArtist) || wantedArtist.includes(artist))
  ) {
    score += 4;
  }

  return score;
}

function firstAppleError(
  payload: AppleResponse<unknown> | null,
  fallback: string,
) {
  return (
    payload?.errors?.[0]?.detail ??
    payload?.errors?.[0]?.title ??
    fallback
  );
}

async function parseJsonSafely<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function appleRequest(
  path: string,
  options: {
    developerToken: string;
    musicUserToken?: string;
    method?: string;
    body?: unknown;
  },
) {
  return fetch(`${APPLE_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${options.developerToken}`,
      ...(options.musicUserToken
        ? { "Music-User-Token": options.musicUserToken }
        : {}),
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      Accept: "application/json",
    },
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    cache: "no-store",
  });
}

async function getUserStorefront(options: {
  developerToken: string;
  musicUserToken: string;
}) {
  const response = await appleRequest("/v1/me/storefront", options);
  const payload =
    await parseJsonSafely<AppleResponse>(response);

  if (!response.ok) {
    throw new AppleAuthorizationError(
      firstAppleError(
        payload,
        "Apple Music could not access this account.",
      ),
      response.status,
    );
  }

  const storefront = payload?.data?.[0]?.id?.trim().toLowerCase();

  if (!storefront) {
    throw new Error("Apple Music did not return a storefront.");
  }

  return storefront;
}

class AppleAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppleAuthorizationError";
  }
}

async function validateCatalogSong(options: {
  developerToken: string;
  storefront: string;
  songId: string;
}) {
  const response = await appleRequest(
    `/v1/catalog/${encodeURIComponent(
      options.storefront,
    )}/songs/${encodeURIComponent(options.songId)}`,
    {
      developerToken: options.developerToken,
    },
  );

  if (!response.ok) return null;

  const payload =
    await parseJsonSafely<AppleResponse>(response);

  return payload?.data?.[0]?.id ?? null;
}

async function findByIsrc(options: {
  developerToken: string;
  storefront: string;
  isrc: string;
}) {
  const isrc = options.isrc.replace(/[^A-Za-z0-9]/g, "");
  if (!isrc) return null;

  const params = new URLSearchParams();
  params.set("filter[isrc]", isrc);

  const response = await appleRequest(
    `/v1/catalog/${encodeURIComponent(
      options.storefront,
    )}/songs?${params.toString()}`,
    {
      developerToken: options.developerToken,
    },
  );

  if (!response.ok) return null;

  const payload =
    await parseJsonSafely<AppleResponse>(response);

  return payload?.data?.[0]?.id ?? null;
}

async function searchCatalogSong(options: {
  developerToken: string;
  storefront: string;
  song: SourceSong;
}) {
  const query = [options.song.title, options.song.artist]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!query) return null;

  const params = new URLSearchParams({
    term: query,
    types: "songs",
    limit: "10",
  });

  const response = await appleRequest(
    `/v1/catalog/${encodeURIComponent(
      options.storefront,
    )}/search?${params.toString()}`,
    {
      developerToken: options.developerToken,
    },
  );

  if (!response.ok) return null;

  const payload =
    await parseJsonSafely<AppleResponse>(response);

  const candidates = payload?.results?.songs?.data ?? [];

  if (candidates.length === 0) return null;

  return [...candidates]
    .sort(
      (a, b) =>
        scoreSearchCandidate(options.song, b) -
        scoreSearchCandidate(options.song, a),
    )[0]?.id ?? null;
}

async function resolveAppleSong(options: {
  developerToken: string;
  storefront: string;
  song: SourceSong;
}) {
  if (options.song.isrc) {
    const isrcMatch = await findByIsrc({
      developerToken: options.developerToken,
      storefront: options.storefront,
      isrc: options.song.isrc,
    });

    if (isrcMatch) return isrcMatch;
  }

  if (inferSourcePlatform(options.song) === "apple") {
    const directId =
      extractAppleCatalogSongId(options.song.track_id) ??
      extractAppleCatalogSongId(options.song.url);

    if (directId) {
      const validated = await validateCatalogSong({
        developerToken: options.developerToken,
        storefront: options.storefront,
        songId: directId,
      });

      if (validated) return validated;
    }
  }

  return searchCatalogSong(options);
}

function buildLoginUrl(
  request: NextRequest,
  mixlistId: string,
) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set(
    "next",
    `/mixlists/${encodeURIComponent(mixlistId)}`,
  );
  return `${url.pathname}${url.search}`;
}

export async function POST(request: NextRequest) {
  const body =
    (await request.json().catch(() => null)) as ExportBody | null;

  const mixlistId = cleanString(body?.mixlistId, 120);
  const musicUserToken = cleanString(
    body?.musicUserToken,
    8_192,
  );

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
        error: "Sign in to export an Apple Music playlist.",
        code: "not_authenticated",
        loginUrl: buildLoginUrl(request, mixlistId),
      },
      { status: 401 },
    );
  }

  if (!musicUserToken) {
    return NextResponse.json(
      {
        error:
          "Connect Apple Music before exporting this Mixlist.",
        code: "apple_music_authorization_required",
      },
      { status: 409 },
    );
  }

  const { data: mixlist, error: mixlistError } =
    await supabase
      .from("mixlists")
      .select("id,title")
      .eq("id", mixlistId)
      .maybeSingle();

  if (mixlistError || !mixlist) {
    return NextResponse.json(
      { error: "Mixlist not found or unavailable." },
      { status: 404 },
    );
  }

  const { data: songRows, error: songsError } =
    await supabase
      .from("mixlist_songs")
      .select(
        "position,platform,track_id,title,artist,url,isrc",
      )
      .eq("mixlist_id", mixlistId)
      .order("position", { ascending: true });

  if (songsError) {
    console.error(
      "Failed to load Mixlist songs for Apple Music export",
      songsError,
    );
    return NextResponse.json(
      { error: "Failed to load Mixlist songs." },
      { status: 500 },
    );
  }

  const songs = (songRows ?? []) as SourceSong[];

  if (songs.length === 0) {
    return NextResponse.json(
      { error: "This Mixlist has no songs to export." },
      { status: 400 },
    );
  }

  if (songs.length > MAX_EXPORT_SONGS) {
    return NextResponse.json(
      {
        error:
          `Apple Music exports are limited to ${MAX_EXPORT_SONGS} songs per Mixlist.`,
        code: "apple_export_too_large",
      },
      { status: 400 },
    );
  }

  let developerToken: string;

  try {
    // No origin restriction here because this token is used server-to-server.
    developerToken = await getAppleDeveloperToken({
      ttlSeconds: 60 * 60 * 24 * 30,
    });
  } catch (error) {
    console.error(
      "Apple Music developer-token generation failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Groovara's Apple Music integration is not configured correctly.",
        code: "apple_developer_token_failed",
      },
      { status: 500 },
    );
  }

  let storefront: string;

  try {
    storefront = await getUserStorefront({
      developerToken,
      musicUserToken,
    });
  } catch (error) {
    if (error instanceof AppleAuthorizationError) {
      return NextResponse.json(
        {
          error:
            "Apple Music authorization needs to be refreshed. Reconnect Apple Music and try again.",
          code: "apple_music_reconnect_required",
        },
        {
          status:
            error.status === 401 || error.status === 403
              ? 409
              : 502,
        },
      );
    }

    console.error("Apple Music storefront lookup failed", error);
    return NextResponse.json(
      {
        error:
          "Apple Music could not determine your storefront.",
        code: "apple_storefront_failed",
      },
      { status: 502 },
    );
  }

  const resolvedSongIds: string[] = [];
  let skippedCount = 0;

  for (const song of songs) {
    try {
      const songId = await resolveAppleSong({
        developerToken,
        storefront,
        song,
      });

      if (!songId) {
        skippedCount += 1;
        continue;
      }

      resolvedSongIds.push(songId);
    } catch (error) {
      skippedCount += 1;
      console.error("Apple Music song resolution failed", {
        title: song.title,
        artist: song.artist,
        error,
      });
    }
  }

  if (resolvedSongIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Groovara could not find Apple Music matches for any songs in this Mixlist.",
        code: "apple_matches_not_found",
        skippedCount,
      },
      { status: 400 },
    );
  }

  const playlistName = `Groovara: ${
    cleanString(mixlist.title, 180) || "Mixlist"
  }`;

  const createResponse = await appleRequest(
    "/v1/me/library/playlists",
    {
      developerToken,
      musicUserToken,
      method: "POST",
      body: {
        attributes: {
          name: playlistName,
          description: "Exported from Groovara",
          isPublic: false,
        },
      },
    },
  );

  const createPayload =
    await parseJsonSafely<AppleResponse<CreatedPlaylist>>(
      createResponse,
    );

  const playlistId =
    createPayload?.data?.[0]?.id?.trim() ?? "";

  if (!createResponse.ok || !playlistId) {
    const authFailure =
      createResponse.status === 401 ||
      createResponse.status === 403;

    return NextResponse.json(
      {
        error: authFailure
          ? "Apple Music authorization needs to be refreshed. Reconnect Apple Music and try again."
          : firstAppleError(
              createPayload,
              "Apple Music could not create the playlist.",
            ),
        code: authFailure
          ? "apple_music_reconnect_required"
          : "apple_playlist_create_failed",
      },
      { status: authFailure ? 409 : 502 },
    );
  }

  let exportedCount = 0;

  for (
    let index = 0;
    index < resolvedSongIds.length;
    index += ADD_TRACK_BATCH_SIZE
  ) {
    const batch = resolvedSongIds.slice(
      index,
      index + ADD_TRACK_BATCH_SIZE,
    );

    const addResponse = await appleRequest(
      `/v1/me/library/playlists/${encodeURIComponent(
        playlistId,
      )}/tracks`,
      {
        developerToken,
        musicUserToken,
        method: "POST",
        body: {
          data: batch.map((songId) => ({
            id: songId,
            type: "songs",
          })),
        },
      },
    );

    if (!addResponse.ok) {
      const payload =
        await parseJsonSafely<AppleResponse>(addResponse);

      const authFailure =
        addResponse.status === 401 ||
        addResponse.status === 403;

      return NextResponse.json(
        {
          error: authFailure
            ? "Apple Music authorization needs to be refreshed. Reconnect Apple Music and try again."
            : firstAppleError(
                payload,
                "Apple Music created the playlist but could not add every song.",
              ),
          code: authFailure
            ? "apple_music_reconnect_required"
            : "apple_playlist_tracks_failed",
          partial: exportedCount > 0,
          playlistId,
          exportedCount,
          skippedCount:
            skippedCount +
            (resolvedSongIds.length - exportedCount),
          storefront,
        },
        { status: authFailure ? 409 : 502 },
      );
    }

    exportedCount += batch.length;
  }

  return NextResponse.json({
    success: true,
    playlistId,
    exportedCount,
    skippedCount,
    storefront,
  });
}
