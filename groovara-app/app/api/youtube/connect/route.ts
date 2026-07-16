import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildYouTubeAuthorizationUrl,
  normalizeReturnTo,
  YOUTUBE_OAUTH_COOKIE,
} from "@/lib/youtubeServer";

export const runtime = "nodejs";

const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

type OAuthCookiePayload = {
  state: string;
  userId: string;
  returnTo: string;
};

function encodeOAuthCookie(payload: OAuthCookiePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const returnTo = normalizeReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
    request.nextUrl.origin,
  );

  if (!user) {
    const resumePath = `/api/youtube/connect?returnTo=${encodeURIComponent(returnTo)}`;
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("next", resumePath);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const state = randomBytes(32).toString("hex");
    const authorizationUrl = buildYouTubeAuthorizationUrl({
      origin: request.nextUrl.origin,
      state,
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(
      YOUTUBE_OAUTH_COOKIE,
      encodeOAuthCookie({ state, userId: user.id, returnTo }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/youtube",
        maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
      },
    );

    return response;
  } catch (error) {
    console.error("Failed to start YouTube OAuth", error);
    const failureUrl = new URL(returnTo, request.nextUrl.origin);
    failureUrl.searchParams.set("youtube", "configuration_error");
    return NextResponse.redirect(failureUrl);
  }
}
