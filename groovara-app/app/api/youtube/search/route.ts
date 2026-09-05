import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimYouTubeSearchBudget,
  type YouTubeSearchBudgetPurpose,
} from "@/lib/youtubeSearchBudget";

export const runtime = "nodejs";

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        medium?: { url?: string };
        default?: { url?: string };
        high?: { url?: string };
      };
    };
  }>;
};

type YouTubeTrack = {
  id: string;
  title: string;
  artist: string;
  album: "YouTube";
  url: string;
  image: string | null;
};

function cleanTitle(raw: string) {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function buildManualSearchUrl(query: string) {
  return (
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(query)
  );
}

function looksLikeYouTubeQuotaError(status: number, detail: string) {
  if (status !== 403 && status !== 429) return false;

  const normalized = detail.toLowerCase();

  return (
    normalized.includes("quota") ||
    normalized.includes("ratelimit") ||
    normalized.includes("rate limit") ||
    normalized.includes("dailylimit") ||
    normalized.includes("daily limit")
  );
}

async function cacheYouTubeTracks(tracks: YouTubeTrack[]) {
  if (tracks.length === 0) return;

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const rows = tracks.map((track) => ({
      video_id: track.id,
      title: track.title,
      channel_title: track.artist,
      thumbnail_url: track.image,
      youtube_url: track.url,
      available: true,
      last_refreshed_at: now,
    }));

    const { error } = await admin
      .from("youtube_api_data_cache")
      .upsert(rows, { onConflict: "video_id" });

    if (error) {
      console.error("YouTube search cache upsert failed", error);
    }
  } catch (error) {
    console.error("YouTube search cache write crashed", error);
  }
}

export async function GET(req: Request) {
  try {
    const key = process.env.YOUTUBE_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: "Missing YOUTUBE_API_KEY env var." },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const usage = (searchParams.get("usage") ?? "").trim();

    if (!q) {
      return NextResponse.json({ tracks: [] });
    }

    const manualSearchUrl = buildManualSearchUrl(q);

    // Conversion/export requests already send usage=automatic and get first
    // priority. Direct Studio searches use the reserved lower-priority pool.
    const purpose: YouTubeSearchBudgetPurpose =
      usage === "automatic" ||
      usage === "priority" ||
      usage === "export"
        ? "priority"
        : "studio";

    const searchBudget = await claimYouTubeSearchBudget(1, purpose);

    if (!searchBudget.allowed) {
      const error =
        purpose === "studio"
          ? "YouTube search is temporarily unavailable in Studio so Groovara can reserve today's remaining searches for Mixlist listening and exports."
          : "YouTube search is temporarily unavailable because today's YouTube search allowance has been reached.";

      return NextResponse.json(
        {
          error,
          code: "youtube_search_budget_exhausted",
          manualSearchUrl,
          budget: searchBudget,
        },
        { status: 429 },
      );
    }

    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(key)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();

      console.error("YouTube search failed", {
        status: res.status,
        body: text,
      });

      if (looksLikeYouTubeQuotaError(res.status, text)) {
        return NextResponse.json(
          {
            error:
              "YouTube search is temporarily unavailable because YouTube's API search limit has been reached.",
            code: "youtube_search_quota_exhausted",
            manualSearchUrl,
            budget: searchBudget,
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          error: `YouTube search failed (${res.status})`,
          detail: text.slice(0, 1000),
          manualSearchUrl,
        },
        { status: res.status },
      );
    }

    const json = (await res.json()) as YouTubeSearchResponse;

    const tracks =
      ((json.items ?? [])
        .map((it): YouTubeTrack | null => {
          const videoId = it.id?.videoId;
          if (!videoId) return null;

          const titleRaw = it.snippet?.title ?? "Unknown Title";
          const channel = it.snippet?.channelTitle ?? "YouTube";

          const image =
            it.snippet?.thumbnails?.medium?.url ??
            it.snippet?.thumbnails?.high?.url ??
            it.snippet?.thumbnails?.default?.url ??
            null;

          return {
            id: videoId,
            title: cleanTitle(titleRaw),
            artist: channel,
            album: "YouTube",
            url: `https://www.youtube.com/watch?v=${videoId}`,
            image,
          };
        })
        .filter((track): track is YouTubeTrack => track !== null)) ?? [];

    await cacheYouTubeTracks(tracks);

    return NextResponse.json({
      tracks,
      searchBudget,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "YouTube route error",
      },
      { status: 500 },
    );
  }
}
