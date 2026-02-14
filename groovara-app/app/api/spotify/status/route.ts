import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ connected: false });

  const { data, error } = await supabase
    .from("user_spotify_accounts")
    .select("spotify_user_id,display_name,profile_url,image_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ connected: false });

  return NextResponse.json({ connected: true, profile: data });
}
