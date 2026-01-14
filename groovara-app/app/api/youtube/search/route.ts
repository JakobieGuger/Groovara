import { NextResponse } from "next/server";

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

function cleanTitle(raw: string) {
  // YouTube titles often contain HTML entities
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
    if (!q) return NextResponse.json({ tracks: [] });

    // Search videos only; "music video" bias via query is a decent first pass.
    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(key)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `YouTube search failed (${res.status})`, detail: text.slice(0, 300) },
        { status: 500 }
      );
    }

    const json = (await res.json()) as YouTubeSearchResponse;

    const tracks =
      (json.items ?? [])
        .map((it) => {
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
            // For YouTube, we don’t reliably know artist/album yet.
            // Use channel as "artist" for now to keep consistent UI.
            artist: channel,
            album: "YouTube",
            url: `https://www.youtube.com/watch?v=${videoId}`,
            image,
          };
        })
        .filter(Boolean) ?? [];

    return NextResponse.json({ tracks });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "YouTube route error" },
      { status: 500 }
    );
  }
}
