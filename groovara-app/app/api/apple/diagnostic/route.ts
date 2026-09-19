import { NextResponse } from "next/server";
import { getAppleDeveloperToken } from "@/lib/appleMusicServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const developerToken = await getAppleDeveloperToken({
      ttlSeconds: 60 * 10,
    });

    const response = await fetch(
      "https://api.music.apple.com/v1/test",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${developerToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const body = await response.text();

    return NextResponse.json(
      {
        ok: response.ok,
        appleStatus: response.status,
        appleStatusText: response.statusText,
        message: response.ok
          ? "Apple accepted Groovara's developer token."
          : "Apple rejected Groovara's developer token.",
        appleResponse: body.slice(0, 1000) || null,
      },
      {
        status: response.ok ? 200 : 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Apple Music diagnostic failed", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Apple Music diagnostic failed.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
