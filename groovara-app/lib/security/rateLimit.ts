import { createClient } from "@/lib/supabase/server";

export type RateLimitAction =
//  | "login_attempt"
//  | "signup_attempt"
  | "create_tracklist"
  | "create_mixlist"
  | "add_song"
  | "manual_add_song"
  | "save_note"
  | "bulk_update_notes"
  | "save_settings"
  | "delete_tracklist"
  | "delete_mixlist"
  | "spotify_import"
  | "submit_feedback";

export type RateLimitConfig = {
  action: RateLimitAction;
  maxAttempts: number;
  windowSeconds: number;
  metadata?: Record<string, unknown>;
};

export type RateLimitResult =
  | {
      ok: true;
      remaining: number;
      resetAtIso: string;
    }
  | {
      ok: false;
      message: string;
      remaining: 0;
      resetAtIso: string;
    };

function nowUtcMs(): number {
  return Date.now();
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function formatRetryMessage(action: RateLimitAction): string {
  switch (action) {
    case "create_tracklist":
      return "Too many tracklist creations. Please wait and try again.";
    case "create_mixlist":
      return "Too many mixlist creations. Please wait and try again.";
    case "add_song":
    case "manual_add_song":
      return "You're adding songs too quickly. Please slow down for a moment.";
    case "save_note":
    case "bulk_update_notes":
      return "You're updating notes too quickly. Please slow down for a moment.";
    case "save_settings":
      return "You've changed settings too many times in a short period. Please wait and try again.";
    case "delete_tracklist":
      return "Too many tracklist deletions. Please wait and try again.";
    case "delete_mixlist":
      return "Too many mixlist deletions. Please wait and try again.";
    case "spotify_import":
      return "Too many Spotify imports. Please wait and try again.";
    case "submit_feedback":
      return "You're submitting feedback too quickly. Please wait a moment and try again.";
    default:
      return "Too many requests. Please wait and try again.";
  }
}
/*
Note: If you ever want to use auth rate limiting, paste these back in the retry message switch and uncomment the entries in rateLimitAction
    case "login_attempt":
      return "Too many login attempts. Please wait and try again.";
    case "signup_attempt":
      return "Too many signup attempts. Please wait and try again.";
*/

export async function enforceRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      message: "You must be logged in.",
      remaining: 0,
      resetAtIso: new Date().toISOString(),
    };
  }

  const windowStartIso = isoFromMs(nowUtcMs() - config.windowSeconds * 1000);

  const { count, error: countError } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", config.action)
    .gte("created_at", windowStartIso)
    .eq("allowed", true);

  if (countError) {
    throw new Error(countError.message || "Failed to evaluate rate limit.");
  }

  const attempts = count ?? 0;

  if (attempts >= config.maxAttempts) {
    const { data: oldestAllowedInWindow, error: resetError } = await supabase
      .from("rate_limit_events")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("action", config.action)
      .gte("created_at", windowStartIso)
      .eq("allowed", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (resetError) {
      throw new Error(resetError.message || "Failed to compute rate limit reset.");
    }

    const resetAtIso = oldestAllowedInWindow?.created_at
      ? isoFromMs(new Date(oldestAllowedInWindow.created_at).getTime() + config.windowSeconds * 1000)
      : isoFromMs(nowUtcMs() + config.windowSeconds * 1000);

    const { error: logError } = await supabase.from("rate_limit_events").insert({
      user_id: user.id,
      action: config.action,
      allowed: false,
      metadata: config.metadata ?? {},
    });

    if (logError) {
      throw new Error(logError.message || "Failed to log rate limit denial.");
    }

    return {
      ok: false,
      message: formatRetryMessage(config.action),
      remaining: 0,
      resetAtIso,
    };
  }

  const { error: insertError } = await supabase.from("rate_limit_events").insert({
    user_id: user.id,
    action: config.action,
    allowed: true,
    metadata: config.metadata ?? {},
  });

  if (insertError) {
    throw new Error(insertError.message || "Failed to record rate limit event.");
  }

  return {
    ok: true,
    remaining: Math.max(config.maxAttempts - attempts - 1, 0),
    resetAtIso: isoFromMs(nowUtcMs() + config.windowSeconds * 1000),
  };
}