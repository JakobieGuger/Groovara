import { NextResponse } from "next/server";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_YOUTUBE_PLAYLIST_ITEMS = 300;

type YouTubeThumbnail = {
  url?: string;
};

type YouTubePlaylistResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: Record<string, YouTubeThumbnail | undefined>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      channelTitle?: string;
      position?: number;
      thumbnails?: Record<string, YouTubeThumbnail | undefined>;
      resourceId?: {
        kind?: string;
        videoId?: string;
      };
    };
  }>;
  error?: {
    message?: string;
  };
};

function getYouTubeApiKey() {
  return (
    process.env.YOUTUBE_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
  );
}

function extractPlaylistId(input: string) {
  const trimmed = input.trim();

  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    const listParam = url.searchParams.get("list");
    if (listParam) return listParam;

    if (url.hostname.includes("youtube.com")) {
      const playlistMatch = url.pathname.match(/\/playlist\/([^/?#]+)/);
      if (playlistMatch?.[1]) return playlistMatch[1];
    }
  } catch {
    // If it is not a URL, fall through and treat it as a raw playlist ID.
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function bestThumbnail(
  thumbnails: Record<string, YouTubeThumbnail | undefined> | undefined,
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

async function youtubeFetch<T>(
  pathname: string,
  params: Record<string, string | number | undefined>,
) {
  const apiKey = getYouTubeApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing YouTube API key. Set YOUTUBE_API_KEY or GOOGLE_API_KEY.",
    );
  }

  const url = new URL(`${YOUTUBE_API_BASE}${pathname}`);
  url.searchParams.set("key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 0,
    },
  });

  const json = (await response.json()) as T & {
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(json.error?.message ?? "YouTube request failed.");
  }

  return json;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
    };

    const playlistId = extractPlaylistId(body.url ?? "");

    if (!playlistId) {
      return NextResponse.json(
        { error: "Paste a valid YouTube playlist URL." },
        { status: 400 },
      );
    }

    const playlistResponse = await youtubeFetch<YouTubePlaylistResponse>(
      "/playlists",
      {
        part: "snippet",
        id: playlistId,
        maxResults: 1,
      },
    );

    const playlist = playlistResponse.items?.[0];

    if (!playlist) {
      return NextResponse.json(
        { error: "That YouTube playlist could not be found or is not public." },
        { status: 404 },
      );
    }

    const tracks: Array<{
      platform: "youtube";
      track_id: string;
      title: string;
      artist: string;
      album: null;
      url: string;
      thumbnail_url: string | null;
      channel_title: string | null;
      position: number;
    }> = [];

    let pageToken: string | undefined;
    let truncated = false;

    do {
      const playlistItemsResponse =
        await youtubeFetch<YouTubePlaylistItemsResponse>("/playlistItems", {
          part: "snippet",
          playlistId,
          maxResults: 50,
          pageToken,
        });

      for (const item of playlistItemsResponse.items ?? []) {
        if (tracks.length >= MAX_YOUTUBE_PLAYLIST_ITEMS) {
          truncated = true;
          break;
        }

        const snippet = item.snippet;
        const videoId = snippet?.resourceId?.videoId;
        const title = snippet?.title?.trim();

        if (!videoId || !title) continue;
        if (title === "Deleted video" || title === "Private video") continue;

        const channelTitle = snippet?.channelTitle?.trim() || null;

        tracks.push({
          platform: "youtube",
          track_id: videoId,
          title,
          artist: channelTitle ?? "YouTube",
          album: null,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail_url: bestThumbnail(snippet?.thumbnails),
          channel_title: channelTitle,
          position: snippet?.position ?? tracks.length,
        });
      }

      if (tracks.length >= MAX_YOUTUBE_PLAYLIST_ITEMS) {
        truncated = true;
        break;
      }

      pageToken = playlistItemsResponse.nextPageToken;
    } while (pageToken);

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No public videos were found in that playlist." },
        { status: 404 },
      );
    }

    const playlistTitle =
      playlist.snippet?.title?.trim() || "Imported YouTube Playlist";

    return NextResponse.json({
      playlist: {
        id: playlist.id ?? playlistId,
        name: playlistTitle,
        description: playlist.snippet?.description ?? null,
        url: `https://www.youtube.com/playlist?list=${playlistId}`,
        thumbnail_url: bestThumbnail(playlist.snippet?.thumbnails),
      },
      tracks,
      truncated,
      imported_count: tracks.length,
    });
  } catch (error: unknown) {
    console.error("YouTube playlist import failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not import that YouTube playlist.",
      },
      { status: 500 },
    );
  }
}