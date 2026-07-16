import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cacheGlobalMatchForSourceUrl,
  findGlobalYouTubeMatch,
  saveGlobalYouTubeMatch,
} from "@/lib/globalTrackMatching";

type Platform = "spotify" | "youtube" | "apple";

type ConvertRequestBody = {
  sourcePlatform: Platform;
  sourceUrl: string;
  sourceTitle: string;
  sourceArtist: string;
  sourceIsrc?: string | null;
  allowSearch?: boolean;
  targetPlatform: Platform;
};

type SearchTrack = {
  id?: string;
  track_id?: string;
  title?: string;
  artist?: string;
  album?: string;
  url?: string;
  image?: string | null;
};

type CachedConversionRow = {
  source_platform: string;
  source_url: string;
  source_title: string;
  source_artist: string;
  target_platform: string;
  target_title: string | null;
  target_artist: string | null;
  target_url: string | null;
  target_track_id: string | null;
  status: string;
  updated_at: string | null;
};

type YouTubeVideoListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
    };
  }>;
};

type CachedYouTubeRefreshResult =
  | {
      kind: "valid";
      row: CachedConversionRow;
    }
  | {
      kind: "missing";
    }
  | {
      kind: "error";
      message: string;
    };

function isPlatform(value: unknown): value is Platform {
  return value === "spotify" || value === "youtube" || value === "apple";
}

function normalizeSearchText(value: string) {
  return value
    .replace(/\(.*?official.*?\)/gi, "")
    .replace(/\(.*?audio.*?\)/gi, "")
    .replace(/\(.*?video.*?\)/gi, "")
    .replace(/\[.*?official.*?\]/gi, "")
    .replace(/\[.*?audio.*?\]/gi, "")
    .replace(/\bofficial video\b/gi, "")
    .replace(/\bofficial audio\b/gi, "")
    .replace(/\bofficial\b/gi, "")
    .replace(/\baudio\b/gi, "")
    .replace(/\bvideo\b/gi, "")
    .replace(/\bvevo\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYouTubeId(
  rawUrl: string | null | undefined,
): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();

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
      const id = parts[markerIndex + 1] ?? null;

      if (
        markerIndex !== -1 &&
        id &&
        /^[A-Za-z0-9_-]{11}$/.test(id)
      ) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function cleanYouTubeTitle(raw: string) {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isOlderThanDays(value: string | null | undefined, days: number) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  return Date.now() - time >= days * 24 * 60 * 60 * 1000;
}

function conversionInvolvesYouTube(row: {
  source_platform: string;
  target_platform: string;
}) {
  return row.source_platform === "youtube" || row.target_platform === "youtube";
}

function getSearchPath(platform: Platform, query: string) {
  const encoded = encodeURIComponent(query);

  switch (platform) {
    case "spotify":
      return `/api/spotify/search?q=${encoded}`;
    case "youtube":
      return `/api/youtube/search?q=${encoded}&usage=automatic`;
    case "apple":
      return `/api/apple/search?q=${encoded}`;
  }
}

function buildCacheResponse(row: {
  source_platform: string;
  source_url: string;
  source_title: string;
  source_artist: string;
  target_platform: string;
  target_title: string | null;
  target_artist: string | null;
  target_url: string | null;
  target_track_id: string | null;
  status: string;
  updated_at?: string | null;
}) {
  return {
    cached: true,
    status: row.status,
    track: {
      title: row.target_title ?? row.source_title,
      artist: row.target_artist ?? row.source_artist,
      platform: row.target_platform,
      track_id: row.target_track_id ?? "",
      url: row.target_url ?? row.source_url,
    },
  };
}

async function refreshCachedYouTubeTarget(
  admin: ReturnType<typeof createAdminClient>,
  row: CachedConversionRow,
): Promise<CachedYouTubeRefreshResult> {
  const videoId =
    extractYouTubeId(row.target_track_id) ??
    extractYouTubeId(row.target_url);

  if (!videoId) {
    return { kind: "missing" };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return {
      kind: "error",
      message: "Missing YOUTUBE_API_KEY.",
    };
  }

  const url = new URL(
    "https://www.googleapis.com/youtube/v3/videos",
  );

  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
  } catch (error) {
    console.error("Cached YouTube video validation crashed", {
      videoId,
      error,
    });

    return {
      kind: "error",
      message: "YouTube video validation failed.",
    };
  }

  if (!response.ok) {
    const detail = await response.text();

    console.error("Cached YouTube video validation failed", {
      videoId,
      status: response.status,
      detail: detail.slice(0, 1000),
    });

    return {
      kind: "error",
      message: `YouTube video validation failed (${response.status}).`,
    };
  }

  const payload =
    (await response.json()) as YouTubeVideoListResponse;

  const item = (payload.items ?? []).find(
    (candidate) => candidate.id === videoId,
  );

  // An empty items array means the cached video no longer exists or is no
  // longer accessible. The caller will fall through to search.list.
  if (!item?.id) {
    return { kind: "missing" };
  }

  const now = new Date().toISOString();

  const refreshedRow: CachedConversionRow = {
    ...row,
    target_title: item.snippet?.title
      ? cleanYouTubeTitle(item.snippet.title)
      : row.target_title,
    target_artist:
      item.snippet?.channelTitle ?? row.target_artist,
    target_url: `https://www.youtube.com/watch?v=${videoId}`,
    target_track_id: videoId,
    status: "found",
    updated_at: now,
  };

  const { error: updateError } = await admin
    .from("platform_conversions")
    .update({
      target_title: refreshedRow.target_title,
      target_artist: refreshedRow.target_artist,
      target_url: refreshedRow.target_url,
      target_track_id: refreshedRow.target_track_id,
      status: refreshedRow.status,
      updated_at: refreshedRow.updated_at,
    })
    .eq("source_url", row.source_url)
    .eq("target_platform", "youtube");

  if (updateError) {
    console.error(
      "Failed to persist refreshed YouTube conversion",
      updateError,
    );

    return {
      kind: "error",
      message: "Failed to update the refreshed conversion cache.",
    };
  }

  console.info(
    "Refreshed stale YouTube conversion with videos.list",
    {
      sourceUrl: row.source_url,
      videoId,
    },
  );

  return {
    kind: "valid",
    row: refreshedRow,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ConvertRequestBody>;

    const sourcePlatform = body.sourcePlatform;
    const sourceUrl = String(body.sourceUrl || "").trim();
    const sourceTitle = String(body.sourceTitle || "").trim();
    const sourceArtist = String(body.sourceArtist || "").trim();
    const sourceIsrc =
      typeof body.sourceIsrc === "string"
        ? body.sourceIsrc
        : null;
    const allowSearch = body.allowSearch !== false;
    const targetPlatform = body.targetPlatform;

    if (!isPlatform(sourcePlatform) || !isPlatform(targetPlatform)) {
      return NextResponse.json(
        { error: "Invalid source or target platform." },
        { status: 400 }
      );
    }

    if (!sourceUrl || !sourceTitle || !sourceArtist) {
      return NextResponse.json(
        { error: "Missing source track information." },
        { status: 400 }
      );
    }

    if (sourcePlatform === targetPlatform) {
      return NextResponse.json({
        cached: false,
        status: "same_platform",
        track: {
          title: sourceTitle,
          artist: sourceArtist,
          platform: sourcePlatform,
          track_id: "",
          url: sourceUrl,
        },
      });
    }

    const admin = createAdminClient();

    // 1. Check persistent cache first.
    const { data: cachedRow, error: cacheError } = await admin
      .from("platform_conversions")
      .select(
        "source_platform,source_url,source_title,source_artist,target_platform,target_title,target_artist,target_url,target_track_id,status,updated_at"
      )
      .eq("source_url", sourceUrl)
      .eq("target_platform", targetPlatform)
      .maybeSingle();

    if (cacheError) {
      console.error("platform conversion cache lookup failed", cacheError);
    }

  if (cachedRow) {
    const typedCachedRow = cachedRow as CachedConversionRow;

    const staleYouTubeCache =
      conversionInvolvesYouTube(typedCachedRow) &&
      isOlderThanDays(typedCachedRow.updated_at, 30);

    if (!staleYouTubeCache) {
      return NextResponse.json(
        buildCacheResponse(typedCachedRow),
      );
    }

    // If the cached result points to YouTube, verify the existing video ID
    // instead of immediately spending a search.list request.
    if (
      typedCachedRow.target_platform === "youtube" &&
      typedCachedRow.status === "found"
    ) {
      const refreshResult =
        await refreshCachedYouTubeTarget(
          admin,
          typedCachedRow,
        );

      if (refreshResult.kind === "valid") {
        return NextResponse.json(
          buildCacheResponse(refreshResult.row),
        );
      }

      if (refreshResult.kind === "error") {
        // Do not burn a search request merely because videos.list or the
        // network temporarily failed.
        return NextResponse.json(
          {
            error: refreshResult.message,
            status: "refresh_error",
            track: {
              title: sourceTitle,
              artist: sourceArtist,
              platform: sourcePlatform,
              track_id: "",
              url: sourceUrl,
            },
          },
          { status: 503 },
        );
      }

      // The video was genuinely missing. Fall through to the existing
      // search code below and find a replacement.
      console.info(
        "Cached YouTube video is unavailable; searching for replacement",
        {
          sourcePlatform,
          sourceUrl,
          cachedVideoId:
            typedCachedRow.target_track_id,
        },
      );
    } else {
      // YouTube is the source rather than the target, or the previous result
      // was not_found/error. Keep the existing re-search behavior.
      console.info(
        "Refreshing stale platform conversion cache",
        {
          sourcePlatform,
          targetPlatform,
          sourceUrl,
        },
      );
    }
  }

  if (targetPlatform === "youtube") {
    const globalMatch = await findGlobalYouTubeMatch({
      admin,
      sourceTitle,
      sourceArtist,
      sourceIsrc,
    });

    if (globalMatch.kind === "error") {
      return NextResponse.json(
        {
          error: globalMatch.message,
          status: "global_cache_error",
        },
        { status: 503 },
      );
    }

    if (globalMatch.kind === "found") {
      await cacheGlobalMatchForSourceUrl({
        admin,
        sourcePlatform,
        sourceUrl,
        sourceTitle,
        sourceArtist,
        row: globalMatch.row,
      });

      return NextResponse.json({
        cached: true,
        globalCached: true,
        matchMethod: globalMatch.matchMethod,
        status: "found",
        track: {
          title:
            globalMatch.row.target_title ??
            sourceTitle,
          artist:
            globalMatch.row.target_artist ??
            sourceArtist,
          platform: "youtube",
          track_id:
            globalMatch.row.target_track_id,
          url: globalMatch.row.target_url,
        },
      });
    }
  }

  if (!allowSearch) {
    return NextResponse.json({
      cached: false,
      status: "search_required",
      searchRequired: true,
      track: {
        title: sourceTitle,
        artist: sourceArtist,
        platform: sourcePlatform,
        track_id: "",
        url: sourceUrl,
      },
    });
  }

    // 2. No usable cache hit, so search the requested target platform.
    const query = `${normalizeSearchText(sourceTitle)} ${normalizeSearchText(
      sourceArtist
    )}`.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Could not build conversion query." },
        { status: 400 }
      );
    }

    const searchUrl = new URL(getSearchPath(targetPlatform, query), req.url);

    const searchResponse = await fetch(searchUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!searchResponse.ok) {
      const detail = await searchResponse.text();

      console.error("platform conversion search failed", {
        targetPlatform,
        status: searchResponse.status,
        detail: detail.slice(0, 500),
      });

      // Cache the failed attempt so we do not keep hammering APIs for the same doomed conversion.
      await admin.from("platform_conversions").upsert(
        {
          source_platform: sourcePlatform,
          source_url: sourceUrl,
          source_title: sourceTitle,
          source_artist: sourceArtist,
          target_platform: targetPlatform,
          target_title: null,
          target_artist: null,
          target_url: null,
          target_track_id: null,
          status: "error",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "source_url,target_platform",
        }
      );

      return NextResponse.json(
        {
          error: `Target platform search failed (${searchResponse.status}).`,
          status: "error",
          track: {
            title: sourceTitle,
            artist: sourceArtist,
            platform: sourcePlatform,
            track_id: "",
            url: sourceUrl,
          },
        },
        { status: 200 }
      );
    }

    const searchJson = await searchResponse.json();

    const match: SearchTrack | null =
      searchJson?.tracks?.[0] ??
      searchJson?.results?.[0] ??
      searchJson?.items?.[0] ??
      null;

    // 3. If no match, cache not_found and return original.
    if (!match) {
      await admin.from("platform_conversions").upsert(
        {
          source_platform: sourcePlatform,
          source_url: sourceUrl,
          source_title: sourceTitle,
          source_artist: sourceArtist,
          target_platform: targetPlatform,
          target_title: null,
          target_artist: null,
          target_url: null,
          target_track_id: null,
          status: "not_found",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "source_url,target_platform",
        }
      );

      return NextResponse.json({
        cached: false,
        status: "not_found",
        track: {
          title: sourceTitle,
          artist: sourceArtist,
          platform: sourcePlatform,
          track_id: "",
          url: sourceUrl,
        },
      });
    }

    const convertedTrack = {
      title: match.title ?? sourceTitle,
      artist: match.artist ?? sourceArtist,
      platform: targetPlatform,
      track_id: match.track_id ?? match.id ?? "",
      url: match.url ?? sourceUrl,
    };

    // 4. Save successful conversion.
    const { error: insertError } = await admin.from("platform_conversions").upsert(
      {
        source_platform: sourcePlatform,
        source_url: sourceUrl,
        source_title: sourceTitle,
        source_artist: sourceArtist,
        target_platform: targetPlatform,
        target_title: convertedTrack.title,
        target_artist: convertedTrack.artist,
        target_url: convertedTrack.url,
        target_track_id: convertedTrack.track_id,
        status: "found",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "source_url,target_platform",
      }
    );

    if (
      targetPlatform === "youtube" &&
      convertedTrack.track_id &&
      convertedTrack.url
    ) {
      await saveGlobalYouTubeMatch({
        admin,
        sourceTitle,
        sourceArtist,
        sourceIsrc,
        targetTrackId: convertedTrack.track_id,
        targetUrl: convertedTrack.url,
        targetTitle: convertedTrack.title,
        targetArtist: convertedTrack.artist,
      });
    }

    if (insertError) {
      console.error("platform conversion cache insert failed", insertError);
    }

    return NextResponse.json({
      cached: false,
      status: "found",
      track: convertedTrack,
    });
  } catch (error) {
    console.error("platform conversion route error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected platform conversion error.",
      },
      { status: 500 }
    );
  }
}