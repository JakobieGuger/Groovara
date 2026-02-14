import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getValidSpotifyAccessToken } from "@/lib/spotifyServer";
export const runtime = "nodejs";


type ExportBody = { tracklistId: string };

type SpotifyMe = { id: string };
type SpotifyCreatePlaylistResponse = {
  id: string;
  external_urls?: { spotify?: string };
};

function toSpotifyUri(trackId: string): string {
  // supports raw id or full uri
  if (trackId.startsWith("spotify:track:")) return trackId;
  return `spotify:track:${trackId}`;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );

    // Try cookie-auth first
    let {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Fallback: Bearer token from client (because your session is in localStorage)
    if (!user) {
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;
    
      if (token) {
        const res = await supabase.auth.getUser(token);
        user = res.data.user ?? null;
      }
    }
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

  const body = (await req.json()) as ExportBody;
  if (!body?.tracklistId) {
    return NextResponse.json({ error: "Missing tracklistId" }, { status: 400 });
  }

  // Fetch tracklist title (use your real column names)
  const { data: tracklist, error: tlErr } = await supabase
    .from("tracklists")
    .select("id,title,user_id")
    .eq("id", body.tracklistId)
    .maybeSingle();

  if (tlErr || !tracklist) {
    return NextResponse.json({ error: "Tracklist not found" }, { status: 404 });
  }

  // Ownership guard (you said you use user_id now)
  if (tracklist.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: songs, error: sErr } = await supabase
    .from("tracklist_songs")
    .select("platform,track_id,position,title,artist")
    .eq("tracklist_id", body.tracklistId)
    .order("position", { ascending: true });

  if (sErr) {
    return NextResponse.json({ error: "Failed to load songs" }, { status: 500 });
  }

  const spotifyUris = (songs ?? [])
    .filter((s) => s.platform === "spotify" && typeof s.track_id === "string" && s.track_id.length > 0)
    .map((s) => toSpotifyUri(s.track_id));

  if (spotifyUris.length === 0) {
    return NextResponse.json(
      { error: "No Spotify tracks in this tracklist yet." },
      { status: 400 }
    );
  }

  const accessToken = await getValidSpotifyAccessToken({
    supabase,
    userId: user.id,
  });

  // Get Spotify user id
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) {
    return NextResponse.json({ error: "Spotify /me failed" }, { status: 502 });
  }
  const me = (await meRes.json()) as SpotifyMe;

  // Create playlist
  const playlistName = `Groovara: ${tracklist.title ?? "Tracklist"}`;
  const createRes = await fetch(
    `https://api.spotify.com/v1/users/${encodeURIComponent(me.id)}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: playlistName,
        description: "Exported from Groovara",
        public: false,
      }),
    }
  );

  if (!createRes.ok) {
    return NextResponse.json({ error: "Spotify create playlist failed" }, { status: 502 });
  }

  const created = (await createRes.json()) as SpotifyCreatePlaylistResponse;
  const playlistId = created.id;

  // Add tracks in batches of 100
  for (let i = 0; i < spotifyUris.length; i += 100) {
    const batch = spotifyUris.slice(i, i + 100);
    const addRes = await fetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: batch }),
      }
    );

    if (!addRes.ok) {
      return NextResponse.json(
        { error: "Spotify add tracks failed", added: i, total: spotifyUris.length },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    playlistId,
    playlistUrl: created.external_urls?.spotify ?? null,
    exportedCount: spotifyUris.length,
  });
}
