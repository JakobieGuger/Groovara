import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const YOUTUBE_STALE_DAYS = 30;
const VALID_SONG_TABLES = new Set(["mixlist_songs", "tracklist_songs"]);

type SongTable = "mixlist_songs" | "tracklist_songs";

type SongRef = {
  table?: SongTable;
  id?: string;
  url?: string | null;
};

type RefreshBody = {
  videoIds?: string[];
  songRefs?: SongRef[];
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
        standard?: { url?: string };
        maxres?: { url?: string };
      };
    };
  }>;
};

type CacheRow = {
  video_id: string;
  title: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
  youtube_url: string | null;
  available: boolean;
  last_refreshed_at: string | null;
};

function cleanTitle(raw: string) {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isLikelyYouTubeId(value: string | null | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]{11}$/.test(value);
}

function extractYouTubeId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (isLikelyYouTubeId(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return isLikelyYouTubeId(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com"
    ) {
      const watchId = parsed.searchParams.get("v");
      if (isLikelyYouTubeId(watchId)) return watchId;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = parts.indexOf("shorts");
      if (shortsIndex !== -1 && isLikelyYouTubeId(parts[shortsIndex + 1])) {
        return parts[shortsIndex + 1];
      }

      const embedIndex = parts.indexOf("embed");
      if (embedIndex !== -1 && isLikelyYouTubeId(parts[embedIndex + 1])) {
        return parts[embedIndex + 1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

function isStale(dateValue: string | null | undefined) {
  if (!dateValue) return true;
  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return true;
  return Date.now() - time >= YOUTUBE_STALE_DAYS * 24 * 60 * 60 * 1000;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function bestThumbnail(
  thumbnails: NonNullable<
    NonNullable<YouTubeVideosResponse["items"]>[number]["snippet"]
  >["thumbnails"]
) {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    null
  );
}

async function updateSongRowsForVideo(
  admin: ReturnType<typeof createAdminClient>,
  videoId: string,
  refs: SongRef[],
  cacheRow: CacheRow
) {
  const title =
    cacheRow.available && cacheRow.title
      ? cacheRow.title
      : "YouTube video unavailable";
  const artist =
    cacheRow.available && cacheRow.channel_title
      ? cacheRow.channel_title
      : "YouTube";
  const url = cacheRow.youtube_url ?? `https://www.youtube.com/watch?v=${videoId}`;

  for (const ref of refs) {
    if (!ref.table || !ref.id || !VALID_SONG_TABLES.has(ref.table)) continue;

    try {
      const { data: row, error: rowError } = await admin
        .from(ref.table)
        .select("id,url")
        .eq("id", ref.id)
        .maybeSingle();

      if (rowError || !row?.url) {
        if (rowError) console.error("YouTube row verification failed", rowError);
        continue;
      }

      const rowVideoId = extractYouTubeId(row.url);
      if (rowVideoId !== videoId) continue;

      const { error: updateError } = await admin
        .from(ref.table)
        .update({
          title,
          artist,
          album: "YouTube",
          url,
        })
        .eq("id", ref.id);

      if (updateError) {
        console.error("YouTube song metadata update failed", updateError);
      }
    } catch (error) {
      console.error("YouTube song metadata update crashed", error);
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RefreshBody;
    const refsByVideoId = new Map<string, SongRef[]>();

    for (const id of body.videoIds ?? []) {
      const videoId = extractYouTubeId(id);
      if (!videoId) continue;
      refsByVideoId.set(videoId, refsByVideoId.get(videoId) ?? []);
    }

    for (const ref of body.songRefs ?? []) {
      const videoId = extractYouTubeId(ref.url);
      if (!videoId) continue;
      refsByVideoId.set(videoId, [...(refsByVideoId.get(videoId) ?? []), ref]);
    }

    const videoIds = [...refsByVideoId.keys()].slice(0, 50);

    if (videoIds.length === 0) {
      return NextResponse.json({ items: [], refreshed: [] });
    }

    const admin = createAdminClient();
    const { data: existingRows, error: existingError } = await admin
      .from("youtube_api_data_cache")
      .select(
        "video_id,title,channel_title,thumbnail_url,youtube_url,available,last_refreshed_at"
      )
      .in("video_id", videoIds);

    if (existingError) {
      console.error("YouTube cache lookup failed", existingError);
    }

    const existingById = new Map<string, CacheRow>(
      ((existingRows ?? []) as CacheRow[]).map((row) => [row.video_id, row])
    );

    const staleIds = videoIds.filter((videoId) => {
      const existing = existingById.get(videoId);
      return !existing || isStale(existing.last_refreshed_at);
    });

    const refreshedIds: string[] = [];

    if (staleIds.length > 0) {
      const key = process.env.YOUTUBE_API_KEY;
      if (!key) {
        return NextResponse.json(
          {
            error: "Missing YOUTUBE_API_KEY env var.",
            items: [...existingById.values()],
            refreshed: [],
          },
          { status: 500 }
        );
      }

      const now = new Date().toISOString();

      for (const group of chunk(staleIds, 50)) {
        const url =
          "https://www.googleapis.com/youtube/v3/videos" +
          `?part=snippet&id=${encodeURIComponent(group.join(","))}` +
          `&key=${encodeURIComponent(key)}`;

        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          const detail = await response.text();
          console.error("YouTube metadata refresh failed", {
            status: response.status,
            detail: detail.slice(0, 1000),
          });
          continue;
        }

        const json = (await response.json()) as YouTubeVideosResponse;
        const returnedById = new Map(
          (json.items ?? [])
            .filter((item) => isLikelyYouTubeId(item.id))
            .map((item) => [item.id as string, item])
        );

        const rows: CacheRow[] = group.map((videoId) => {
          const item = returnedById.get(videoId);

          if (!item?.snippet) {
            return {
              video_id: videoId,
              title: null,
              channel_title: null,
              thumbnail_url: null,
              youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
              available: false,
              last_refreshed_at: now,
            };
          }

          return {
            video_id: videoId,
            title: cleanTitle(item.snippet.title ?? "Unknown Title"),
            channel_title: item.snippet.channelTitle ?? "YouTube",
            thumbnail_url: bestThumbnail(item.snippet.thumbnails),
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            available: true,
            last_refreshed_at: now,
          };
        });

        const { error: upsertError } = await admin
          .from("youtube_api_data_cache")
          .upsert(rows, { onConflict: "video_id" });

        if (upsertError) {
          console.error("YouTube metadata cache upsert failed", upsertError);
          continue;
        }

        for (const row of rows) {
          existingById.set(row.video_id, row);
          refreshedIds.push(row.video_id);

          await updateSongRowsForVideo(
            admin,
            row.video_id,
            refsByVideoId.get(row.video_id) ?? [],
            row
          );
        }
      }
    }

    const items = videoIds
      .map((videoId) => existingById.get(videoId))
      .filter((row): row is CacheRow => Boolean(row));

    return NextResponse.json({ items, refreshed: refreshedIds });
  } catch (error) {
    console.error("YouTube refresh route error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected YouTube refresh error.",
      },
      { status: 500 }
    );
  }
}
