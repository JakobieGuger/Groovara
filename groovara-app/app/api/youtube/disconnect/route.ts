import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getYouTubeAccount, revokeGoogleToken } from "@/lib/youtubeServer";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const account = await getYouTubeAccount(user.id);

    if (!account) {
      return NextResponse.json({ success: true, connected: false });
    }

    let revoked = false;
    try {
      revoked = await revokeGoogleToken(
        account.refresh_token || account.access_token,
      );
    } catch (error) {
      console.error("Google token revocation request failed", error);
    }

    const admin = createAdminClient();
    const { error: deleteError } = await admin
      .from("user_youtube_accounts")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Failed to delete YouTube connection", deleteError);
      return NextResponse.json(
        { error: "Failed to disconnect YouTube." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      connected: false,
      revoked,
    });
  } catch (error) {
    console.error("YouTube disconnect route failed", error);
    return NextResponse.json(
      { error: "Failed to disconnect YouTube." },
      { status: 500 },
    );
  }
}
