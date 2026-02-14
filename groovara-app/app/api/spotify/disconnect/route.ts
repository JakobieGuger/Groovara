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

export async function POST(req: NextRequest) {
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

  // cookie-auth first
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // bearer fallback
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
            global: { headers: { Authorization: `Bearer ${token}` } },
          }
        );
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("user_spotify_accounts")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
