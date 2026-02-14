import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

  // Fallback: bearer token auth
  if (!user) {
    const token = extractBearer(req);
    if (token) {
      const authRes = await supabase.auth.getUser(token);
      user = authRes.data.user ?? null;

      if (user) {
        supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: { getAll: () => [], setAll: () => {} },
            global: {
              headers: { Authorization: `Bearer ${token}` },
            },
          }
        );
      }
    }
  }

  if (!user) return NextResponse.json({ connected: false });

  const { data, error } = await supabase
    .from("user_spotify_accounts")
    .select("spotify_user_id,display_name,profile_url,image_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ connected: false });

  return NextResponse.json({ connected: true, profile: data });
}
