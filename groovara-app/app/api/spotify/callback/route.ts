import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { writeAuditLog } from "@/lib/security/auditLog";

export const runtime = "nodejs";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
};

type SpotifyMe = {
  id: string;
  display_name?: string;
  external_urls?: { spotify?: string };
  images?: { url: string }[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=no_code", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  const cookieStore = await cookies();

  // Start with cookie-aware client
  let supabase = createServerClient(
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

  // 1) Try cookie-auth first
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // 2) Fallback: read the token bridge cookie set during /api/spotify/login
  if (!user) {
    const token = cookieStore.get("gv_spotify_supa_token")?.value?.trim() || null;

    if (token) {
      const authRes = await supabase.auth.getUser(token);
      user = authRes.data.user ?? null;

      if (user) {
        // Rebuild with bearer token so RLS works for DB writes
        supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return [];
              },
              setAll() {},
            },
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        );
      }
    }
  }

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  // Exchange code -> tokens
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID!}:${process.env.SPOTIFY_CLIENT_SECRET!}`
  ).toString("base64");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/settings?error=token_exchange_failed", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  const tokenData = (await tokenRes.json()) as SpotifyTokenResponse;

  if (!tokenData.access_token) {
    return NextResponse.redirect(
      new URL("/settings?error=token_missing", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  // Pull profile (optional but recommended)
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const me: SpotifyMe | null = meRes.ok ? ((await meRes.json()) as SpotifyMe) : null;

  const expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;

  // Preserve refresh_token if Spotify doesn’t resend it
  const { data: existing } = await supabase
    .from("user_spotify_accounts")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle<{ refresh_token: string | null }>();

  const refresh_token = tokenData.refresh_token ?? existing?.refresh_token ?? null;

  if (!refresh_token) {
    return NextResponse.redirect(
      new URL("/settings?error=no_refresh_token", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  const { error: upsertErr } = await supabase
    .from("user_spotify_accounts")
    .upsert(
      {
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token,
        expires_at,
        scope: tokenData.scope ?? null,
        spotify_user_id: me?.id ?? null,
        display_name: me?.display_name ?? null,
        profile_url: me?.external_urls?.spotify ?? null,
        image_url: me?.images?.[0]?.url ?? null,
      },
      { onConflict: "user_id" }
    );

  if (upsertErr) {
    console.error("UPSERT ERROR:", upsertErr);
    return NextResponse.redirect(
      new URL("/settings?error=db_upsert_failed", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  await writeAuditLog({
    eventType: "spotify_connect",
    userId: user.id,
    resourceType: "spotify_account",
    resourceId: user.id,
    success: true,
    metadata: {
      source: "app/api/spotify/callback/route.ts",
    },
  });

  // Clear the bridge token cookie (no reason to keep it)
  cookieStore.set("gv_spotify_supa_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.redirect(
    new URL("/settings?connected=spotify", process.env.NEXT_PUBLIC_SITE_URL)
  );
}
