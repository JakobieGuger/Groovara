import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

export const runtime = "nodejs";

function extractBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(req.url);

  const tokenFromQuery = url.searchParams.get("token")?.trim() || null;
  const tokenFromHeader = extractBearer(req);
  const token = tokenFromQuery ?? tokenFromHeader;

  // cookie-aware client (works if your app ever has auth cookies)
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

  // Try cookie-auth first
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback to provided token (localStorage session)
  if (!user && token) {
    const authRes = await supabase.auth.getUser(token);
    user = authRes.data.user ?? null;

    if (user) {
      // rebuild client with bearer token (RLS context)
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

      // Store token temporarily so callback can see the user
      cookieStore.set("gv_spotify_supa_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10, // 10 minutes
      });
    }
  }

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL)
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const scope = [
    "playlist-modify-private",
    "playlist-modify-public",
    "user-read-private",
    "user-read-email",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
    show_dialog: "true",
  });

  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );
}
