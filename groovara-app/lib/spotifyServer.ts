// lib/spotifyServer.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type SpotifyAccountRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
};

type SpotifyRefreshResponse = {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
};

export async function getValidSpotifyAccessToken(opts: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<string> {
  const { supabase, userId } = opts;

  const { data, error } = await supabase
    .from("user_spotify_accounts")
    .select("user_id,access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .maybeSingle<SpotifyAccountRow>();

  if (error || !data) {
    throw new Error("Spotify not connected");
  }

  const now = Math.floor(Date.now() / 1000);

  // refresh if expired or expiring within 60s
  if (data.expires_at > now + 60) return data.access_token;

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID!}:${process.env.SPOTIFY_CLIENT_SECRET!}`
  ).toString("base64");

  const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });

  if (!refreshRes.ok) {
    throw new Error("Spotify token refresh failed");
  }

  const refreshData = (await refreshRes.json()) as SpotifyRefreshResponse;

  const newExpiresAt = Math.floor(Date.now() / 1000) + refreshData.expires_in;
  const newRefreshToken = refreshData.refresh_token ?? data.refresh_token;

  const { error: upErr } = await supabase
    .from("user_spotify_accounts")
    .update({
      access_token: refreshData.access_token,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId);

  if (upErr) throw new Error("Failed to persist refreshed token");

  return refreshData.access_token;
}
