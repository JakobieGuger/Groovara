import { NextResponse } from "next/server";

async function getAccessToken() {
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");


  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const token = await getAccessToken();

    const r = await fetch(
      `https://api.spotify.com/v1/search?` +
        new URLSearchParams({
          q,
          type: "track",
          limit: "10",
        }).toString(),
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `Spotify search failed: ${r.status} ${text}` },
        { status: 500 }
      );
    }

    const data: unknown = await r.json();

    type SpotifyImage = { url: string };
    type SpotifyArtist = { name: string };
    type SpotifyAlbum = { name: string; images?: SpotifyImage[] };
    type SpotifyTrack = {
      id: string;
      name: string;
      artists?: SpotifyArtist[];
      album?: SpotifyAlbum;
      external_urls?: { spotify?: string };
    };
    type SpotifySearchResponse = { tracks?: { items?: SpotifyTrack[] } };

    const d = data as SpotifySearchResponse;
    const items = d.tracks?.items ?? [];

    const tracks = items.map((t) => ({
      id: t.id,
      title: t.name,
      artist: (t.artists ?? []).map((a) => a.name).join(", "),
      album: t.album?.name ?? "",
      url: t.external_urls?.spotify ?? "",
      image: t.album?.images?.[2]?.url ?? t.album?.images?.[1]?.url ?? null,
    }));

    return NextResponse.json({ tracks });
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : "Unknown error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
}
