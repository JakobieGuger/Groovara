import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Platform = "spotify" | "youtube" | "apple";

type ConvertRequestBody = {
  sourcePlatform: Platform;
  sourceUrl: string;
  sourceTitle: string;
  sourceArtist: string;
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

function getSearchPath(platform: Platform, query: string) {
  const encoded = encodeURIComponent(query);

  switch (platform) {
    case "spotify":
      return `/api/spotify/search?q=${encoded}`;
    case "youtube":
      return `/api/youtube/search?q=${encoded}`;
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ConvertRequestBody>;

    const sourcePlatform = body.sourcePlatform;
    const sourceUrl = String(body.sourceUrl || "").trim();
    const sourceTitle = String(body.sourceTitle || "").trim();
    const sourceArtist = String(body.sourceArtist || "").trim();
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
        "source_platform,source_url,source_title,source_artist,target_platform,target_title,target_artist,target_url,target_track_id,status"
      )
      .eq("source_url", sourceUrl)
      .eq("target_platform", targetPlatform)
      .maybeSingle();

    if (cacheError) {
      console.error("platform conversion cache lookup failed", cacheError);
    }

    if (cachedRow) {
      return NextResponse.json(buildCacheResponse(cachedRow));
    }

    // 2. No cache hit, so search the requested target platform.
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