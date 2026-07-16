import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import {
  getValidYouTubeAccessToken,
  YouTubeConnectionError,
} from "@/lib/youtubeServer";

export const runtime = "nodejs";

const MAX_EXPORT_SONGS = 200;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

type ExportMode = "search_missing" | "matched_only";

type ExportBody = {
  mixlistId?: string;
  mode?: ExportMode;
};

type SourcePlatform = "spotify" | "youtube" | "apple";

type MixlistSong = {
  position: number | null;
  title: string | null;
  artist: string | null;
  isrc: string | null;
  url: string | null;
};

type ConversionResponse = {
  cached?: boolean;
  status?: string;
  track?: {
    platform?: string;
    track_id?: string;
    url?: string;
  };
};

type YouTubeSearchResponse = {
  tracks?: Array<{
    id?: string;
    track_id?: string;
    url?: string;
  }>;
};

type YouTubeListResponse = {
  items?: Array<{ id?: string }>;
  error?: YouTubeErrorPayload["error"];
};

type YouTubePlaylistResponse = {
  id?: string;
  error?: YouTubeErrorPayload["error"];
};

type YouTubeErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
};

type ResolveResult = {
  videoId: string | null;
  searchRequestUsed: boolean;
};

class YouTubeApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason: string | null,
  ) {
    super(message);
    this.name = "YouTubeApiRequestError";
  }
}

function extractYouTubeId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    const isYouTubeHost =
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com");

    if (!isYouTubeHost) return null;

    const watchId = parsed.searchParams.get("v");
    if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;

    const parts = parsed.pathname.split("/").filter(Boolean);
    for (const marker of ["shorts", "embed", "live"] as const) {
      const markerIndex = parts.indexOf(marker);
      if (markerIndex !== -1) {
        const id = parts[markerIndex + 1] ?? null;
        return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function inferSourcePlatform(url: string): SourcePlatform | null {
  const value = url.toLowerCase();

  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return "youtube";
  }

  if (value.includes("spotify.com")) return "spotify";

  if (value.includes("music.apple.com") || value.includes("itunes.apple.com")) {
    return "apple";
  }

  return null;
}

function getErrorDetails(payload: YouTubeErrorPayload | null) {
  const firstError = payload?.error?.errors?.[0];

  return {
    message:
      firstError?.message ||
      payload?.error?.message ||
      "The YouTube API request failed.",
    reason: firstError?.reason ?? null,
  };
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildReturnPath(mixlistId: string, mode: ExportMode) {
  const params = new URLSearchParams({
    resumeYouTubeExport: "1",
    youtubeExportMode: mode,
  });

  return `/mixlists/${encodeURIComponent(mixlistId)}?${params.toString()}`;
}

function buildConnectUrl(
  request: NextRequest,
  mixlistId: string,
  mode: ExportMode,
) {
  const url = new URL("/api/youtube/connect", request.nextUrl.origin);
  url.searchParams.set("returnTo", buildReturnPath(mixlistId, mode));
  return `${url.pathname}${url.search}`;
}

function buildLoginUrl(
  request: NextRequest,
  mixlistId: string,
  mode: ExportMode,
) {
  const connectPath = buildConnectUrl(request, mixlistId, mode);
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("next", connectPath);
  return `${url.pathname}${url.search}`;
}

async function resolveWithPlatformConversion(options: {
  request: NextRequest;
  song: MixlistSong;
  sourcePlatform: SourcePlatform;
  allowSearch: boolean;
}): Promise<ResolveResult> {
  const response = await fetch(
    new URL("/api/convert", options.request.nextUrl.origin),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourcePlatform: options.sourcePlatform,
        sourceUrl: options.song.url ?? "",
        sourceTitle: options.song.title ?? "Unknown title",
        sourceArtist: options.song.artist ?? "Unknown artist",
        sourceIsrc: options.song.isrc ?? null,
        targetPlatform: "youtube",
        allowSearch: options.allowSearch,
      }),
      cache: "no-store",
    },
  );

  const payload = await parseJsonSafely<ConversionResponse>(response);
  const searchRequestUsed =
    options.allowSearch &&
    payload?.cached === false &&
    payload?.status !== "search_required";

  if (!response.ok || !payload?.track) {
    return { videoId: null, searchRequestUsed };
  }

  const videoId =
    extractYouTubeId(payload.track.url) ||
    (payload.track.platform === "youtube" &&
    /^[A-Za-z0-9_-]{11}$/.test(payload.track.track_id ?? "")
      ? payload.track.track_id!
      : null);

  return { videoId, searchRequestUsed };
}

async function resolveWithDirectYouTubeSearch(options: {
  request: NextRequest;
  song: MixlistSong;
}): Promise<ResolveResult> {
  const query = `${options.song.title ?? ""} ${options.song.artist ?? ""}`.trim();
  if (!query) return { videoId: null, searchRequestUsed: false };

  const url = new URL("/api/youtube/search", options.request.nextUrl.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("usage", "automatic");

  const response = await fetch(url, { cache: "no-store" });
  const payload = await parseJsonSafely<YouTubeSearchResponse>(response);

  if (!response.ok) {
    return { videoId: null, searchRequestUsed: true };
  }

  const first = payload?.tracks?.[0];
  const videoId =
    extractYouTubeId(first?.url) ||
    (/^[A-Za-z0-9_-]{11}$/.test(first?.track_id ?? first?.id ?? "")
      ? (first?.track_id ?? first?.id ?? null)
      : null);

  return { videoId, searchRequestUsed: true };
}

async function resolveSongToYouTube(options: {
  request: NextRequest;
  song: MixlistSong;
  allowSearch: boolean;
}): Promise<ResolveResult> {
  const directId = extractYouTubeId(options.song.url);
  if (directId) return { videoId: directId, searchRequestUsed: false };

  const sourcePlatform = inferSourcePlatform(options.song.url ?? "");

  if (sourcePlatform && sourcePlatform !== "youtube") {
    return resolveWithPlatformConversion({
      request: options.request,
      song: options.song,
      sourcePlatform,
      allowSearch: options.allowSearch,
    });
  }

  if (!options.allowSearch) {
    return { videoId: null, searchRequestUsed: false };
  }

  return resolveWithDirectYouTubeSearch({
    request: options.request,
    song: options.song,
  });
}

async function validateVideoIds(options: {
  accessToken: string;
  videoIds: string[];
}) {
  const available = new Set<string>();
  const uniqueIds = [...new Set(options.videoIds)];
  let requestCount = 0;

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const batch = uniqueIds.slice(index, index + 50);
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "status");
    url.searchParams.set("id", batch.join(","));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
      },
      cache: "no-store",
    });
    requestCount += 1;

    const payload = await parseJsonSafely<YouTubeListResponse>(response);

    if (!response.ok) {
      const detail = getErrorDetails(payload);
      throw new YouTubeApiRequestError(
        detail.message,
        response.status,
        detail.reason,
      );
    }

    for (const item of payload?.items ?? []) {
      if (item.id) available.add(item.id);
    }
  }

  return { available, requestCount };
}

function sanitizeYouTubePlaylistTitle(rawTitle: string) {
  const cleaned = rawTitle
    .normalize("NFKC")
    // YouTube rejects some control/format characters that can arrive in
    // imported Spotify playlist names even though they are visually hidden.
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g,
      " ",
    )
    // Angle brackets are not useful in a playlist title and are rejected by
    // several Google metadata validators.
    .replace(/</g, "(")
    .replace(/>/g, ")")
    .replace(/\s+/g, " ")
    .trim();

  const prefixed = `Groovara: ${cleaned || "Mixlist"}`;

  // YouTube caps playlist titles at 150 UTF-16 code units. A plain
  // .slice(0, 150) can split an emoji's surrogate pair and produce malformed
  // Unicode, so truncate one complete code point at a time instead.
  let safeTitle = "";

  for (const character of prefixed) {
    const codePoint = character.codePointAt(0) ?? 0;

    // Drop isolated surrogate code units if malformed text made it this far.
    if (
      character.length === 1 &&
      codePoint >= 0xd800 &&
      codePoint <= 0xdfff
    ) {
      continue;
    }

    if (safeTitle.length + character.length > 150) break;
    safeTitle += character;
  }

  return safeTitle.trim() || "Groovara: Mixlist";
}

async function createPlaylist(options: {
  accessToken: string;
  title: string;
}) {
  const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
  url.searchParams.set("part", "snippet,status");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        title: options.title,
        description: "Exported from Groovara.",
      },
      status: {
        privacyStatus: "private",
      },
    }),
    cache: "no-store",
  });

  const payload = await parseJsonSafely<YouTubePlaylistResponse>(response);

  if (!response.ok || !payload?.id) {
    const detail = getErrorDetails(payload);
    throw new YouTubeApiRequestError(
      detail.message,
      response.status,
      detail.reason,
    );
  }

  return payload.id;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryPlaylistInsert(options: {
  status: number;
  reason: string | null;
  message: string;
}) {
  const normalizedReason = (options.reason ?? "").toLowerCase();
  const normalizedMessage = options.message.toLowerCase();

  return (
    options.status === 409 ||
    options.status === 500 ||
    options.status === 502 ||
    options.status === 503 ||
    options.status === 504 ||
    normalizedReason === "aborted" ||
    normalizedReason === "conflict" ||
    normalizedReason === "backenderror" ||
    normalizedReason === "backendnotconnected" ||
    normalizedReason === "internalerror" ||
    normalizedReason === "notready" ||
    normalizedMessage.includes("operation was aborted")
  );
}

async function insertPlaylistItem(options: {
  accessToken: string;
  playlistId: string;
  videoId: string;
}) {
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set("part", "snippet");

  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            playlistId: options.playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId: options.videoId,
            },
          },
        }),
        cache: "no-store",
      });

      // Always consume the body so Node can release the underlying connection.
      const rawBody = await response.text();

      if (response.ok) {
        return { ok: true as const, attempts: attempt };
      }

      let payload: YouTubeErrorPayload | null = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody) as YouTubeErrorPayload;
        } catch {
          payload = null;
        }
      }

      const detail = getErrorDetails(payload);
      const retryable = shouldRetryPlaylistInsert({
        status: response.status,
        reason: detail.reason,
        message: detail.message,
      });

      if (retryable && attempt < maxAttempts) {
        console.warn("Retrying transient YouTube playlist insert", {
          playlistId: options.playlistId,
          videoId: options.videoId,
          status: response.status,
          reason: detail.reason,
          attempt,
        });
        await sleep(1000 * attempt);
        continue;
      }

      return {
        ok: false as const,
        status: response.status,
        reason: detail.reason,
        message: detail.message,
        attempts: attempt,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "YouTube request failed.";
      const name = error instanceof Error ? error.name : "UnknownError";
      const retryable =
        name === "AbortError" ||
        message.toLowerCase().includes("aborted") ||
        message.toLowerCase().includes("fetch failed");

      if (retryable && attempt < maxAttempts) {
        console.warn("Retrying aborted YouTube playlist insert", {
          playlistId: options.playlistId,
          videoId: options.videoId,
          name,
          message,
          attempt,
        });
        await sleep(1000 * attempt);
        continue;
      }

      return {
        ok: false as const,
        status: 0,
        reason: retryable ? "request_aborted" : "network_error",
        message,
        attempts: attempt,
      };
    }
  }

  return {
    ok: false as const,
    status: 0,
    reason: "youtube_insert_failed",
    message: "YouTube playlist insertion failed.",
    attempts: maxAttempts,
  };
}

function connectionFailureResponse(options: {
  request: NextRequest;
  mixlistId: string;
  error: YouTubeConnectionError;
  mode: ExportMode;
}) {
  const reconnectCodes = new Set([
    "youtube_not_connected",
    "youtube_reconnect_required",
  ]);

  if (reconnectCodes.has(options.error.code)) {
    return NextResponse.json(
      {
        error: options.error.message,
        code: options.error.code,
        connectUrl: buildConnectUrl(
          options.request,
          options.mixlistId,
          options.mode,
        ),
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      error: options.error.message,
      code: options.error.code,
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ExportBody | null;
  const mixlistId = String(body?.mixlistId ?? "").trim();
  const exportMode: ExportMode =
    body?.mode === "matched_only" ? "matched_only" : "search_missing";

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
        error: "Sign in to export a YouTube playlist.",
        code: "not_authenticated",
        loginUrl: buildLoginUrl(request, mixlistId, exportMode),
      },
      { status: 401 },
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidYouTubeAccessToken({ userId: user.id });
  } catch (error) {
    if (error instanceof YouTubeConnectionError) {
      return connectionFailureResponse({
        request,
        mixlistId,
        error,
        mode: exportMode,
      });
    }

    console.error("Failed to obtain YouTube access token", error);
    return NextResponse.json(
      { error: "Failed to access the connected YouTube account." },
      { status: 500 },
    );
  }

  try {
    const rateLimit = await enforceRateLimit({
      action: "youtube_export",
      ...RATE_LIMITS.youtube_export,
      metadata: {
        source: "app/api/youtube/export/route.ts",
        mixlist_id: mixlistId,
        export_mode: exportMode,
      },
    });

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: rateLimit.message,
          code: "youtube_export_rate_limited",
          resetAt: rateLimit.resetAtIso,
        },
        { status: 429 },
      );
    }
  } catch (error) {
    console.error("YouTube export rate-limit check failed", error);
    return NextResponse.json(
      { error: "Could not verify the export rate limit." },
      { status: 500 },
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
    .select("position,title,artist,url,isrc")
    .eq("mixlist_id", mixlistId)
    .order("position", { ascending: true });

  if (songsError) {
    console.error("Failed to load Mixlist songs for YouTube export", songsError);
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

  if (songs.length > MAX_EXPORT_SONGS) {
    return NextResponse.json(
      {
        error: `YouTube exports are currently limited to ${MAX_EXPORT_SONGS} songs per Mixlist.`,
        code: "youtube_export_too_large",
      },
      { status: 400 },
    );
  }

  const resolutionCache = new Map<string, ResolveResult>();
  const orderedResolvedIds: string[] = [];
  let searchRequests = 0;
  let unresolvedCount = 0;

  for (const song of songs) {
    const cacheKey = [song.url, song.title, song.artist].join("\u0000");
    let result = resolutionCache.get(cacheKey);

    if (!result) {
      try {
        result = await resolveSongToYouTube({
          request,
          song,
          allowSearch: exportMode === "search_missing",
        });
      } catch (error) {
        console.error("YouTube song resolution failed", {
          title: song.title,
          artist: song.artist,
          error,
        });
        result = { videoId: null, searchRequestUsed: false };
      }

      resolutionCache.set(cacheKey, result);
      if (result.searchRequestUsed) searchRequests += 1;
    }

    if (result.videoId) orderedResolvedIds.push(result.videoId);
    else unresolvedCount += 1;
  }

  if (orderedResolvedIds.length === 0) {
    return NextResponse.json(
      {
        error: "Groovara could not find YouTube matches for this Mixlist.",
        code: "youtube_matches_not_found",
        unresolvedCount,
        searchRequests,
      },
      { status: 400 },
    );
  }

  let validationRequestCount = 0;
  let availableVideoIds: Set<string>;

  try {
    const validation = await validateVideoIds({
      accessToken,
      videoIds: orderedResolvedIds,
    });
    availableVideoIds = validation.available;
    validationRequestCount = validation.requestCount;
  } catch (error) {
    console.error("YouTube video validation failed", error);

    if (error instanceof YouTubeApiRequestError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.reason ?? "youtube_video_validation_failed",
        },
        { status: error.status === 403 ? 429 : 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to validate YouTube matches." },
      { status: 502 },
    );
  }

  const orderedAvailableIds = orderedResolvedIds.filter((videoId) =>
    availableVideoIds.has(videoId),
  );
  const unavailableCount = orderedResolvedIds.length - orderedAvailableIds.length;

  if (orderedAvailableIds.length === 0) {
    return NextResponse.json(
      {
        error: "The matched YouTube videos are no longer available.",
        code: "youtube_matches_unavailable",
        unresolvedCount,
        unavailableCount,
        searchRequests,
      },
      { status: 400 },
    );
  }

  const playlistTitle = sanitizeYouTubePlaylistTitle(
    mixlist.title?.trim() || "Mixlist",
  );

  let playlistId: string;
  try {
    playlistId = await createPlaylist({
      accessToken,
      title: playlistTitle,
    });
  } catch (error) {
    console.error("YouTube playlist creation failed", error);

    if (error instanceof YouTubeApiRequestError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.reason ?? "youtube_playlist_create_failed",
        },
        {
          status:
            error.status === 400
              ? 400
              : error.status === 401
                ? 401
                : error.status === 403
                  ? 429
                  : 502,
        },
      );
    }

    return NextResponse.json(
      { error: "Failed to create the YouTube playlist." },
      { status: 502 },
    );
  }

  const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(
    playlistId,
  )}`;

  // Give a newly-created playlist a brief moment to propagate before the
  // first playlistItems.insert call. This costs no quota and avoids a small
  // class of immediate post-creation conflicts.
  await sleep(500);

  let exportedCount = 0;
  let insertAttemptCount = 0;
  let insertFailureCount = 0;
  let fatalInsertError: string | null = null;
  let fatalInsertReason: string | null = null;
  let fatalInsertStatus: number | null = null;

  for (const videoId of orderedAvailableIds) {
    const result = await insertPlaylistItem({
      accessToken,
      playlistId,
      videoId,
    });
    insertAttemptCount += result.attempts;

    if (result.ok) {
      exportedCount += 1;
      continue;
    }

    insertFailureCount += 1;
    console.error("YouTube playlist item insert failed", {
      videoId,
      status: result.status,
      reason: result.reason,
      message: result.message,
      attempts: result.attempts,
    });

    // A video-specific 400/404 can be skipped. Authorization, quota, conflict,
    // and service failures are likely to affect every remaining insertion, so
    // stop rather than burning 50 units on each remaining song.
    if (result.status !== 400 && result.status !== 404) {
      fatalInsertError = result.message;
      fatalInsertReason = result.reason;
      fatalInsertStatus = result.status;
      break;
    }
  }

  const skippedCount =
    unresolvedCount + unavailableCount + insertFailureCount;
  const estimatedGeneralQuotaUnits =
    50 + validationRequestCount + insertAttemptCount * 50;

  console.info("YouTube Mixlist export completed", {
    mixlistId,
    userId: user.id,
    playlistId,
    songCount: songs.length,
    exportedCount,
    skippedCount,
    searchRequests,
    estimatedGeneralQuotaUnits,
  });

  if (fatalInsertError) {
    return NextResponse.json(
      {
        error: fatalInsertError,
        code: fatalInsertReason ?? "youtube_playlist_partially_exported",
        youtubeStatus: fatalInsertStatus,
        partial: exportedCount > 0,
        playlistId,
        // An empty private playlist often renders as "playlist doesn't exist"
        // in YouTube's UI, so only offer a link when at least one song landed.
        playlistUrl: exportedCount > 0 ? playlistUrl : null,
        exportedCount,
        skippedCount,
        searchRequests,
        estimatedGeneralQuotaUnits,
      },
      { status: 502 },
    );
  }

  if (exportedCount === 0) {
    return NextResponse.json(
      {
        error: "YouTube created the playlist, but none of its songs could be added.",
        code: "youtube_playlist_empty",
        playlistId,
        playlistUrl: null,
        exportedCount,
        skippedCount,
        searchRequests,
        estimatedGeneralQuotaUnits,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    mode: exportMode,
    playlistId,
    playlistUrl,
    exportedCount,
    skippedCount,
    unresolvedCount,
    unavailableCount,
    searchRequests,
    estimatedGeneralQuotaUnits,
  });
}