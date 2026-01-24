import { NextResponse } from "next/server";

function extractSpotifyPlaylistId(input: string): string | null {
  const s = input.trim();

  const uriMatch = s.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  try {
    const u = new URL(s);
    if (u.hostname.includes("open.spotify.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("playlist");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {}

  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s;
  return null;
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to get Spotify token");
  const json = (await res.json()) as unknown;

  if (
    typeof json === "object" &&
    json !== null &&
    "access_token" in json &&
    typeof (json as { access_token?: unknown }).access_token === "string"
  ) {
    return (json as { access_token: string }).access_token;
  }

  throw new Error("Spotify token response missing access_token");
}

type SpotifyPlaylistMeta = {
  id: string;
  name?: string;
  description?: string | null;
  tracks?: { total?: number };
};

type SpotifyArtist = { name?: string };
type SpotifyAlbum = { name?: string };
type SpotifyTrack = {
  type?: string;
  id?: string;
  name?: string;
  uri?: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  external_urls?: { spotify?: string };
};

type SpotifyPlaylistItem = { track?: SpotifyTrack };

type SpotifyTracksPage = {
  items?: SpotifyPlaylistItem[];
  next?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const url =
      typeof body === "object" && body !== null && "url" in body
        ? (body as { url?: unknown }).url
        : undefined;

    const playlistId = extractSpotifyPlaylistId(typeof url === "string" ? url : "");
    if (!playlistId) {
      return NextResponse.json({ error: "Invalid Spotify playlist URL." }, { status: 400 });
    }

    const token = await getSpotifyAccessToken();

    const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!metaRes.ok) {
      return NextResponse.json(
        { error: "Couldn’t fetch playlist (is it public?)" },
        { status: 400 }
      );
    }

    const meta = (await metaRes.json()) as SpotifyPlaylistMeta;

    let nextUrl: string | null =
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    const tracks: Array<{
      platform: "spotify";
      track_id: string;
      title: string;
      artist: string;
      album: string | null;
      url: string;
    }> = [];

    while (nextUrl) {
      const itemsRes = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!itemsRes.ok) break;

      const page = (await itemsRes.json()) as SpotifyTracksPage;
      const items = Array.isArray(page.items) ? page.items : [];

      for (const it of items) {
        const t = it?.track;
        if (!t || t.type !== "track") continue;
        if (!t.id) continue;

        const title = t.name ?? "";
        const artist = Array.isArray(t.artists)
          ? t.artists
              .map((a) => a?.name)
              .filter((n): n is string => typeof n === "string" && n.length > 0)
              .join(", ")
          : "";
        const album = t.album?.name ?? null;
        const url =
          t.external_urls?.spotify ??
          (t.id ? `https://open.spotify.com/track/${t.id}` : "");

        if (!title || !artist || !url) continue;

        tracks.push({
          platform: "spotify",
          track_id: t.id,
          title,
          artist,
          album,
          url,
        });
      }

      nextUrl = page.next ?? null;
    }

    return NextResponse.json({
      playlist: {
        id: meta.id,
        name: meta.name ?? "Imported Playlist",
        description: meta.description ?? null,
        total: meta.tracks?.total ?? tracks.length,
      },
      tracks,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
