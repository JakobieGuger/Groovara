import { NextRequest, NextResponse } from "next/server";
import { getAppleDeveloperToken } from "@/lib/appleMusicServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const requestOrigin = request.nextUrl.origin;
    const tokenOrigin =
      requestOrigin.startsWith("https://")
        ? requestOrigin
        : null;

    const developerToken = await getAppleDeveloperToken({
      // Keep the recommended origin restriction for HTTPS production.
      // During local HTTP development, omit the optional origin claim so
      // MusicKit authorization is not rejected because of a local-origin
      // mismatch inside Apple's web authorization flow.
      origin: tokenOrigin,
      ttlSeconds: 60 * 60,
    });

    return NextResponse.json(
      { developerToken },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Apple developer-token route failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Apple Music is not configured.",
      },
      { status: 500 },
    );
  }
}
