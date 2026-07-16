import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getYouTubeConnectionSummary,
  YouTubeConnectionError,
} from "@/lib/youtubeServer";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { connected: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  try {
    const connection = await getYouTubeConnectionSummary(user.id);

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json(connection);
  } catch (error) {
    console.error("YouTube status route failed", error);

    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof YouTubeConnectionError
            ? error.message
            : "Failed to load YouTube connection status.",
      },
      { status: 500 },
    );
  }
}
