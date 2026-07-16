import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTitleArtistIdentity,
  normalizeIsrc,
} from "@/lib/trackIdentity";

const YOUTUBE_CACHE_DAYS = 30;

type AdminClient = ReturnType<typeof createAdminClient>;

export type GlobalTrackMatchRow = {
  identity_type: "isrc" | "title_artist";
  identity_value: string;
  target_platform: "youtube";
  source_title: string;
  source_artist: string;
  source_isrc: string | null;
  target_track_id: string;
  target_url: string;
  target_title: string | null;
  target_artist: string | null;
  available: boolean;
  last_verified_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type YouTubeVideoListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
    };
  }>;
};

export type GlobalTrackMatchLookupResult =
  | {
      kind: "found";
      row: GlobalTrackMatchRow;
      matchMethod: "isrc" | "title_artist";
    }
  | {
      kind: "missing";
    }
  | {
      kind: "error";
      message: string;
    };

function extractYouTubeId(
  rawUrlOrId: string | null | undefined,
): string | null {
  if (!rawUrlOrId) return null;

  const trimmed = rawUrlOrId.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    const isYouTubeHost =
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com");

    if (!isYouTubeHost) return null;

    const watchId = parsed.searchParams.get("v");

    if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) {
      return watchId;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);

    for (const marker of ["shorts", "embed", "live"] as const) {
      const markerIndex = parts.indexOf(marker);
      if (markerIndex === -1) continue;

      const id = parts[markerIndex + 1] ?? null;
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function cleanYouTubeTitle(raw: string) {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isOlderThanDays(
  value: string | null | undefined,
  days: number,
) {
  if (!value) return true;

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;

  return Date.now() - time >= days * 24 * 60 * 60 * 1000;
}

async function loadAlias(
  admin: AdminClient,
  identityType: "isrc" | "title_artist",
  identityValue: string,
): Promise<GlobalTrackMatchRow | null> {
  const { data, error } = await admin
    .from("global_track_matches")
    .select(
      "identity_type,identity_value,target_platform,source_title,source_artist,source_isrc,target_track_id,target_url,target_title,target_artist,available,last_verified_at,created_at,updated_at",
    )
    .eq("identity_type", identityType)
    .eq("identity_value", identityValue)
    .eq("target_platform", "youtube")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "Failed to read the global track-match cache.",
    );
  }

  return (data as GlobalTrackMatchRow | null) ?? null;
}

async function deleteAliasesForVideo(
  admin: AdminClient,
  videoId: string,
) {
  const { error } = await admin
    .from("global_track_matches")
    .delete()
    .eq("target_platform", "youtube")
    .eq("target_track_id", videoId);

  if (error) {
    console.error("Failed to delete unavailable global YouTube aliases", {
      videoId,
      error,
    });
  }
}

async function refreshGlobalYouTubeMatch(
  admin: AdminClient,
  row: GlobalTrackMatchRow,
): Promise<GlobalTrackMatchLookupResult> {
  const videoId =
    extractYouTubeId(row.target_track_id) ??
    extractYouTubeId(row.target_url);

  if (!videoId) {
    return { kind: "missing" };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return {
      kind: "error",
      message: "Missing YOUTUBE_API_KEY.",
    };
  }

  const url = new URL(
    "https://www.googleapis.com/youtube/v3/videos",
  );

  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
  } catch (error) {
    console.error("Global YouTube match validation crashed", {
      videoId,
      error,
    });

    return {
      kind: "error",
      message: "YouTube video validation failed.",
    };
  }

  if (!response.ok) {
    const detail = await response.text();

    console.error("Global YouTube match validation failed", {
      videoId,
      status: response.status,
      detail: detail.slice(0, 1000),
    });

    return {
      kind: "error",
      message: `YouTube video validation failed (${response.status}).`,
    };
  }

  const payload =
    (await response.json()) as YouTubeVideoListResponse;

  const item = (payload.items ?? []).find(
    (candidate) => candidate.id === videoId,
  );

  if (!item?.id) {
    await deleteAliasesForVideo(admin, videoId);
    return { kind: "missing" };
  }

  const now = new Date().toISOString();
  const targetTitle = item.snippet?.title
    ? cleanYouTubeTitle(item.snippet.title)
    : row.target_title;
  const targetArtist =
    item.snippet?.channelTitle ?? row.target_artist;
  const targetUrl =
    `https://www.youtube.com/watch?v=${videoId}`;

  const { error: updateError } = await admin
    .from("global_track_matches")
    .update({
      target_track_id: videoId,
      target_url: targetUrl,
      target_title: targetTitle,
      target_artist: targetArtist,
      available: true,
      last_verified_at: now,
      updated_at: now,
    })
    .eq("target_platform", "youtube")
    .eq("target_track_id", videoId);

  if (updateError) {
    console.error("Failed to persist refreshed global YouTube match", {
      videoId,
      updateError,
    });

    return {
      kind: "error",
      message: "Failed to update the global track-match cache.",
    };
  }

  return {
    kind: "found",
    matchMethod: row.identity_type,
    row: {
      ...row,
      target_track_id: videoId,
      target_url: targetUrl,
      target_title: targetTitle,
      target_artist: targetArtist,
      available: true,
      last_verified_at: now,
      updated_at: now,
    },
  };
}

export async function findGlobalYouTubeMatch(args: {
  admin: AdminClient;
  sourceTitle: string;
  sourceArtist: string;
  sourceIsrc?: string | null;
}): Promise<GlobalTrackMatchLookupResult> {
  const {
    admin,
    sourceTitle,
    sourceArtist,
  } = args;

  const sourceIsrc = normalizeIsrc(args.sourceIsrc);
  const titleArtistKey = buildTitleArtistIdentity(
    sourceTitle,
    sourceArtist,
  );

  const candidates: Array<{
    identityType: "isrc" | "title_artist";
    identityValue: string;
  }> = [];

  if (sourceIsrc) {
    candidates.push({
      identityType: "isrc",
      identityValue: sourceIsrc,
    });
  }

  if (titleArtistKey) {
    candidates.push({
      identityType: "title_artist",
      identityValue: titleArtistKey,
    });
  }

  try {
    for (const candidate of candidates) {
      const row = await loadAlias(
        admin,
        candidate.identityType,
        candidate.identityValue,
      );

      if (!row || !row.available) continue;

      // Do not reuse a title/artist fallback when both rows have known,
      // different ISRCs. This protects remasters and alternate recordings.
      if (
        candidate.identityType === "title_artist" &&
        sourceIsrc &&
        row.source_isrc &&
        row.source_isrc !== sourceIsrc
      ) {
        continue;
      }

      if (
        !isOlderThanDays(
          row.last_verified_at,
          YOUTUBE_CACHE_DAYS,
        )
      ) {
        return {
          kind: "found",
          row,
          matchMethod: candidate.identityType,
        };
      }

      const refreshed = await refreshGlobalYouTubeMatch(
        admin,
        row,
      );

      if (refreshed.kind !== "missing") {
        return refreshed;
      }
    }

    return { kind: "missing" };
  } catch (error) {
    console.error("Global YouTube match lookup failed", error);

    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Global YouTube match lookup failed.",
    };
  }
}

function buildAliasRow(args: {
  identityType: "isrc" | "title_artist";
  identityValue: string;
  sourceTitle: string;
  sourceArtist: string;
  sourceIsrc: string | null;
  targetTrackId: string;
  targetUrl: string;
  targetTitle: string | null;
  targetArtist: string | null;
}) {
  const now = new Date().toISOString();

  return {
    identity_type: args.identityType,
    identity_value: args.identityValue,
    target_platform: "youtube",
    source_title: args.sourceTitle,
    source_artist: args.sourceArtist,
    source_isrc: args.sourceIsrc,
    target_track_id: args.targetTrackId,
    target_url: args.targetUrl,
    target_title: args.targetTitle,
    target_artist: args.targetArtist,
    available: true,
    last_verified_at: now,
    updated_at: now,
  };
}

export async function saveGlobalYouTubeMatch(args: {
  admin: AdminClient;
  sourceTitle: string;
  sourceArtist: string;
  sourceIsrc?: string | null;
  targetTrackId: string;
  targetUrl: string;
  targetTitle?: string | null;
  targetArtist?: string | null;
}) {
  const sourceIsrc = normalizeIsrc(args.sourceIsrc);
  const titleArtistKey = buildTitleArtistIdentity(
    args.sourceTitle,
    args.sourceArtist,
  );

  if (!args.targetTrackId || !args.targetUrl) return;

  if (sourceIsrc) {
    const isrcRow = buildAliasRow({
      identityType: "isrc",
      identityValue: sourceIsrc,
      sourceTitle: args.sourceTitle,
      sourceArtist: args.sourceArtist,
      sourceIsrc,
      targetTrackId: args.targetTrackId,
      targetUrl: args.targetUrl,
      targetTitle: args.targetTitle ?? null,
      targetArtist: args.targetArtist ?? null,
    });

    const { error } = await args.admin
      .from("global_track_matches")
      .upsert(isrcRow, {
        onConflict:
          "identity_type,identity_value,target_platform",
      });

    if (error) {
      console.error("Failed to save global ISRC match", error);
    }
  }

  if (!titleArtistKey) return;

  const existingTitleAlias = await loadAlias(
    args.admin,
    "title_artist",
    titleArtistKey,
  );

  // Keep an existing alias when it is tied to a different known ISRC.
  const conflictingKnownIsrc =
    Boolean(existingTitleAlias?.source_isrc) &&
    Boolean(sourceIsrc) &&
    existingTitleAlias?.source_isrc !== sourceIsrc;

  // Do not replace an alias with unknown ISRC data when the existing row
  // already knows which recording it represents.
  const wouldEraseKnownIsrc =
    Boolean(existingTitleAlias?.source_isrc) &&
    !sourceIsrc;

  if (conflictingKnownIsrc || wouldEraseKnownIsrc) {
    return;
  }

  const titleRow = buildAliasRow({
    identityType: "title_artist",
    identityValue: titleArtistKey,
    sourceTitle: args.sourceTitle,
    sourceArtist: args.sourceArtist,
    sourceIsrc,
    targetTrackId: args.targetTrackId,
    targetUrl: args.targetUrl,
    targetTitle: args.targetTitle ?? null,
    targetArtist: args.targetArtist ?? null,
  });

  const { error } = await args.admin
    .from("global_track_matches")
    .upsert(titleRow, {
      onConflict:
        "identity_type,identity_value,target_platform",
    });

  if (error) {
    console.error(
      "Failed to save global title/artist match",
      error,
    );
  }
}

export async function cacheGlobalMatchForSourceUrl(args: {
  admin: AdminClient;
  sourcePlatform: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceArtist: string;
  row: GlobalTrackMatchRow;
}) {
  const { error } = await args.admin
    .from("platform_conversions")
    .upsert(
      {
        source_platform: args.sourcePlatform,
        source_url: args.sourceUrl,
        source_title: args.sourceTitle,
        source_artist: args.sourceArtist,
        target_platform: "youtube",
        target_title:
          args.row.target_title ?? args.sourceTitle,
        target_artist:
          args.row.target_artist ?? args.sourceArtist,
        target_url: args.row.target_url,
        target_track_id: args.row.target_track_id,
        status: "found",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "source_url,target_platform",
      },
    );

  if (error) {
    console.error(
      "Failed to backfill URL-specific conversion cache",
      error,
    );
  }
}
