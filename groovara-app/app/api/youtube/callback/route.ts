import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildReturnUrl,
  exchangeYouTubeAuthorizationCode,
  fetchConnectedYouTubeChannel,
  getYouTubeAccount,
  saveYouTubeAccount,
  YOUTUBE_OAUTH_COOKIE,
  YouTubeConnectionError,
} from "@/lib/youtubeServer";

export const runtime = "nodejs";

type OAuthCookiePayload = {
  state: string;
  userId: string;
  returnTo: string;
};

function decodeOAuthCookie(raw: string | undefined): OAuthCookiePayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<OAuthCookiePayload>;

    if (
      typeof parsed.state !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.returnTo !== "string"
    ) {
      return null;
    }

    return {
      state: parsed.state,
      userId: parsed.userId,
      returnTo: parsed.returnTo,
    };
  } catch {
    return null;
  }
}

function statesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function redirectAndClearCookie(
  request: NextRequest,
  returnTo: string,
  params: Record<string, string>,
) {
  const response = NextResponse.redirect(
    buildReturnUrl(request.nextUrl.origin, returnTo, params),
  );
  response.cookies.delete(YOUTUBE_OAUTH_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const cookiePayload = decodeOAuthCookie(
    request.cookies.get(YOUTUBE_OAUTH_COOKIE)?.value,
  );
  const fallbackReturnTo = cookiePayload?.returnTo ?? "/hub";

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectAndClearCookie(request, fallbackReturnTo, {
      youtube:
        oauthError === "access_denied" ? "connection_cancelled" : "connection_failed",
    });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (
    !cookiePayload ||
    !code ||
    !state ||
    !statesMatch(cookiePayload.state, state)
  ) {
    return redirectAndClearCookie(request, fallbackReturnTo, {
      youtube: "invalid_oauth_state",
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== cookiePayload.userId) {
    return redirectAndClearCookie(request, cookiePayload.returnTo, {
      youtube: "authentication_required",
    });
  }

  try {
    const existingAccount = await getYouTubeAccount(user.id);
    const tokens = await exchangeYouTubeAuthorizationCode({
      code,
      origin: request.nextUrl.origin,
    });

    const channel = await fetchConnectedYouTubeChannel(tokens.access_token!);
    const canReuseExistingRefreshToken =
      Boolean(existingAccount?.refresh_token) &&
      existingAccount?.channel_id === channel.channelId;
    const refreshToken =
      tokens.refresh_token ??
      (canReuseExistingRefreshToken ? existingAccount?.refresh_token : null);

    if (!refreshToken) {
      throw new YouTubeConnectionError(
        "Google did not return a refresh token. Please reconnect and approve access again.",
        "youtube_refresh_token_missing",
      );
    }

    await saveYouTubeAccount({
      userId: user.id,
      accessToken: tokens.access_token!,
      refreshToken,
      expiresIn: tokens.expires_in!,
      scope: tokens.scope ?? null,
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
    });

    return redirectAndClearCookie(request, cookiePayload.returnTo, {
      youtube: "connected",
    });
  } catch (error) {
    console.error("YouTube OAuth callback failed", error);

    const errorCode =
      error instanceof YouTubeConnectionError
        ? error.code
        : "youtube_connection_failed";

    return redirectAndClearCookie(request, cookiePayload.returnTo, {
      youtube: errorCode,
    });
  }
}
