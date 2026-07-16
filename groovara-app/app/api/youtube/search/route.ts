import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimYouTubeAutomaticSearchBudget,
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
  // YouTube titles often contain HTML entities.
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
    // Search should still work even if compliance cache writes fail.
    console.error("YouTube search cache write crashed", error);
  }
}

export async function GET(req: Request) {
  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Missing YOUTUBE_API_KEY env var." },
        { status: 500 }
      );
    }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const usage = (searchParams.get("usage") ?? "").trim();
    
  if (!q) {
    return NextResponse.json({ tracks: [] });
  }
  
  let automaticSearchBudget = null;
  
  if (usage === "automatic") {
    automaticSearchBudget =
      await claimYouTubeAutomaticSearchBudget(1);
  
    if (!automaticSearchBudget.allowed) {
      return NextResponse.json(
        {
          error:
            "Groovara's automatic YouTube search budget has been reached for today.",
          code: "youtube_search_budget_exhausted",
          budget: automaticSearchBudget,
        },
        { status: 429 },
      );
    }
  }
    if (!q) return NextResponse.json({ tracks: [] });

    // Search videos only; "music video" bias via query is a decent first pass.
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

      return NextResponse.json(
        {
          error: `YouTube search failed (${res.status})`,
          detail: text.slice(0, 1000),
        },
        { status: res.status }
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
            // For YouTube, we do not reliably know artist/album yet.
            // Use channel as "artist" for now to keep consistent UI.
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
    automaticSearchBudget,
  });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "YouTube route error" },
      { status: 500 }
    );
  }
}
