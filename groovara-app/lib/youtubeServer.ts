import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const YOUTUBE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/youtube";

export const YOUTUBE_OAUTH_COOKIE = "groovara_youtube_oauth";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const YOUTUBE_CHANNELS_ENDPOINT =
  "https://www.googleapis.com/youtube/v3/channels";

export type YouTubeAccountRow = {
  user_id: string;
  google_account_id: string | null;
  channel_id: string | null;
  channel_title: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string | null;
  created_at?: string;
  updated_at?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type YouTubeChannelsResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type YouTubeConnectionSummary = {
  connected: true;
  channelId: string | null;
  channelTitle: string | null;
  scope: string | null;
  updatedAt: string | null;
};

export class YouTubeConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "YouTubeConnectionError";
  }
}

function requireEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new YouTubeConnectionError(
      `Missing ${name} environment variable.`,
      "youtube_oauth_not_configured",
    );
  }
  return value;
}

function getYouTubeOAuthCredentials() {
  return {
    clientId: requireEnvironmentValue("YOUTUBE_OAUTH_CLIENT_ID"),
    clientSecret: requireEnvironmentValue("YOUTUBE_OAUTH_CLIENT_SECRET"),
  };
}

export function getYouTubeOAuthConfig(origin?: string) {
  const { clientId, clientSecret } = getYouTubeOAuthCredentials();
  const configuredRedirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim();

  const redirectUri =
    configuredRedirectUri ||
    (origin ? `${origin}/api/youtube/callback` : undefined);

  if (!redirectUri) {
    throw new YouTubeConnectionError(
      "Missing YOUTUBE_OAUTH_REDIRECT_URI environment variable.",
      "youtube_oauth_not_configured",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildYouTubeAuthorizationUrl(options: {
  origin: string;
  state: string;
}): URL {
  const { clientId, redirectUri } = getYouTubeOAuthConfig(options.origin);
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_OAUTH_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", options.state);

  return url;
}

export function normalizeReturnTo(
  rawReturnTo: string | null | undefined,
  origin: string,
  fallback = "/hub",
): string {
  if (!rawReturnTo) return fallback;

  try {
    const parsed = new URL(rawReturnTo, origin);
    if (parsed.origin !== origin) return fallback;

    const relative = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return relative.startsWith("/") ? relative : fallback;
  } catch {
    return fallback;
  }
}

export function buildReturnUrl(
  origin: string,
  returnTo: string,
  params: Record<string, string>,
): URL {
  const destination = new URL(normalizeReturnTo(returnTo, origin), origin);

  for (const [key, value] of Object.entries(params)) {
    destination.searchParams.set(key, value);
  }

  return destination;
}

export async function exchangeYouTubeAuthorizationCode(options: {
  code: string;
  origin: string;
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getYouTubeOAuthConfig(
    options.origin,
  );

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: options.code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    console.error("YouTube OAuth token exchange failed", {
      status: response.status,
      error: payload.error,
      description: payload.error_description,
    });

    throw new YouTubeConnectionError(
      payload.error_description || "Google did not return usable YouTube tokens.",
      payload.error || "youtube_token_exchange_failed",
    );
  }

  return payload;
}

export async function fetchConnectedYouTubeChannel(accessToken: string) {
  const url = new URL(YOUTUBE_CHANNELS_ENDPOINT);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "1");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as YouTubeChannelsResponse;

  if (!response.ok) {
    console.error("YouTube channel lookup failed", {
      status: response.status,
      message: payload.error?.message,
    });

    throw new YouTubeConnectionError(
      payload.error?.message || "Failed to read the connected YouTube channel.",
      "youtube_channel_lookup_failed",
    );
  }

  const channel = payload.items?.[0];
  if (!channel?.id) {
    throw new YouTubeConnectionError(
      "This Google account does not currently have a usable YouTube channel.",
      "youtube_channel_missing",
    );
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title ?? "YouTube channel",
  };
}

export async function getYouTubeAccount(
  userId: string,
): Promise<YouTubeAccountRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_youtube_accounts")
    .select(
      "user_id,google_account_id,channel_id,channel_title,access_token,refresh_token,expires_at,scope,created_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<YouTubeAccountRow>();

  if (error) {
    console.error("Failed to load YouTube account", error);
    throw new YouTubeConnectionError(
      "Failed to load the connected YouTube account.",
      "youtube_account_lookup_failed",
    );
  }

  return data;
}

export async function getYouTubeConnectionSummary(
  userId: string,
): Promise<YouTubeConnectionSummary | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_youtube_accounts")
    .select("channel_id,channel_title,scope,updated_at")
    .eq("user_id", userId)
    .maybeSingle<{
      channel_id: string | null;
      channel_title: string | null;
      scope: string | null;
      updated_at: string | null;
    }>();

  if (error) {
    console.error("Failed to load YouTube connection status", error);
    throw new YouTubeConnectionError(
      "Failed to load YouTube connection status.",
      "youtube_status_lookup_failed",
    );
  }

  if (!data) return null;

  return {
    connected: true,
    channelId: data.channel_id,
    channelTitle: data.channel_title,
    scope: data.scope,
    updatedAt: data.updated_at,
  };
}

export async function saveYouTubeAccount(options: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string | null;
  channelId: string;
  channelTitle: string;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + options.expiresIn;

  const { error } = await admin.from("user_youtube_accounts").upsert(
    {
      user_id: options.userId,
      google_account_id: null,
      channel_id: options.channelId,
      channel_title: options.channelTitle,
      access_token: options.accessToken,
      refresh_token: options.refreshToken,
      expires_at: expiresAt,
      scope: options.scope,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Failed to save YouTube account", error);
    throw new YouTubeConnectionError(
      "Failed to save the connected YouTube account.",
      "youtube_account_save_failed",
    );
  }
}

export async function getValidYouTubeAccessToken(options: {
  userId: string;
}): Promise<string> {
  const account = await getYouTubeAccount(options.userId);

  if (!account) {
    throw new YouTubeConnectionError(
      "YouTube is not connected.",
      "youtube_not_connected",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at > now + 60) return account.access_token;

  const { clientId, clientSecret } = getYouTubeOAuthCredentials();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token || !payload.expires_in) {
    console.error("YouTube access token refresh failed", {
      status: response.status,
      error: payload.error,
      description: payload.error_description,
    });

    throw new YouTubeConnectionError(
      "Your YouTube connection has expired. Please reconnect YouTube.",
      "youtube_reconnect_required",
    );
  }

  const admin = createAdminClient();
  const expiresAt = Math.floor(Date.now() / 1000) + payload.expires_in;
  const { error } = await admin
    .from("user_youtube_accounts")
    .update({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? account.refresh_token,
      expires_at: expiresAt,
      scope: payload.scope ?? account.scope,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", options.userId);

  if (error) {
    console.error("Failed to persist refreshed YouTube token", error);
    throw new YouTubeConnectionError(
      "Failed to save the refreshed YouTube connection.",
      "youtube_refresh_save_failed",
    );
  }

  return payload.access_token;
}

export async function revokeGoogleToken(token: string): Promise<boolean> {
  const response = await fetch(GOOGLE_REVOKE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  });

  return response.ok;
}
