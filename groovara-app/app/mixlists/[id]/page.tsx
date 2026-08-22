"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import InlineNotice from "../../../lib/InlineNotice";
import { supabase } from "../../../lib/supabaseClient";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { convertTrackPlatform } from "@/lib/platformConversion";
import { copyMixlistToStudioAction } from "./actions";
import {
  createTheme,
  TrackScene,
  TrackTransition,
  TrackView,
  type UiTrack,
} from "../../../lib/mixlistPlayer";

type Mixlist = {
  id: string;
  title: string | null;
  message: string | null;
  finishing_note: string | null;
  reveal_mode: boolean;
  include_song_notes: boolean;
  owner_user_id: string;
};

type MixSong = {
  id: string;
  position: number;
  title: string;
  artist: string;
  album: string | null;
  isrc: string | null;
  url: string;
  note: string | null;
};

type MixlistProgressRow = {
  mixlist_id: string;
  user_id: string;
  revealed_count: number | null;
  clicked_json: boolean[] | null;
};

const purpleActionButton =
  "w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest gv-accent transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50";

// Shared Mixlists are public. Use a client that never reads or refreshes a
// browser auth session for the public Mixlist/song payload itself.
const publicSupabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

function getPlatform(url: string): UiTrack["platform"] {
  const value = url.toLowerCase();
  if (value.includes("youtube.com") || value.includes("youtu.be"))
    return "youtube";
  if (value.includes("spotify.com")) return "spotify";
  if (value.includes("music.apple.com") || value.includes("itunes.apple.com"))
    return "apple";
  return "other";
}

function extractYouTubeId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com"
    ) {
      const watchId = parsed.searchParams.get("v");
      if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = parts.indexOf("shorts");
      if (shortsIndex !== -1) {
        const id = parts[shortsIndex + 1] ?? null;
        return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }

      const embedIndex = parts.indexOf("embed");
      if (embedIndex !== -1) {
        const id = parts[embedIndex + 1] ?? null;
        return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

type YouTubeRefreshRow = {
  video_id: string;
  title: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
  youtube_url: string | null;
  available: boolean;
  last_refreshed_at: string | null;
};

async function refreshYouTubeSongsForCompliance(list: MixSong[]) {
  const songRefs = list
    .map((song) => {
      const videoId = extractYouTubeId(song.url);
      if (!videoId) return null;

      return {
        table: "mixlist_songs",
        id: song.id,
        url: song.url,
      };
    })
    .filter(
      (ref): ref is { table: "mixlist_songs"; id: string; url: string } =>
        ref !== null,
    );

  if (songRefs.length === 0) return list;

  try {
    const response = await fetch("/api/youtube/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ songRefs }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("YouTube metadata refresh failed", detail.slice(0, 500));
      return list;
    }

    const data = (await response.json()) as { items?: YouTubeRefreshRow[] };
    const byVideoId = new Map(
      (data.items ?? []).map((item) => [item.video_id, item]),
    );

    return list.map((song) => {
      const videoId = extractYouTubeId(song.url);
      if (!videoId) return song;

      const fresh = byVideoId.get(videoId);
      if (!fresh) return song;

      if (!fresh.available) {
        return {
          ...song,
          title: "YouTube video unavailable",
          artist: "YouTube",
          album: "YouTube",
          url: fresh.youtube_url ?? song.url,
        };
      }

      return {
        ...song,
        title: fresh.title ?? song.title,
        artist: fresh.channel_title ?? song.artist,
        album: song.album ?? "YouTube",
        url: fresh.youtube_url ?? song.url,
      };
    });
  } catch (error) {
    console.error("YouTube metadata refresh crashed", error);
    return list;
  }
}

function toUiTrack(song: MixSong, index: number): UiTrack {
  const theme = createTheme(
    `${song.id}:${song.title}:${song.artist}:${index}`,
    song.title,
    song.artist,
  );

  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    image: null,
    url: song.url ?? null,
    platform: getPlatform(song.url ?? ""),
    durationMs: 1,
    notes: song.note,
    theme,
  };
}

type YouTubeExportMode = "search_missing" | "matched_only";

type YouTubeExportPreviewSong = {
  position: number;
  title: string;
  artist: string;
  status: "matched" | "search_required" | "unresolved";
  matchSource:
    | "direct_youtube"
    | "source_url_cache"
    | "isrc"
    | "title_artist"
    | null;
};

type YouTubeExportPreview = {
  success: true;
  mixlistId: string;
  title: string;
  songCount: number;
  matchedCount: number;
  searchRequiredCount: number;
  uniqueSearchRequiredCount: number;
  unresolvedCount: number;
  estimatedSearchRequests: number;
  estimatedGeneralQuotaUnits: number;
  canSearchAndExport: boolean;
  canExportMatchedOnly: boolean;
  budget: {
    used: number;
    remaining: number;
    dailyLimit: number;
    quotaDay: string;
    resetsAt: string;
  };
  songs: YouTubeExportPreviewSong[];
};

function formatYouTubeBudgetReset(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "midnight Pacific";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildManualYouTubeSearchUrl(title: string, artist: string) {
  const query = [artist, title].filter(Boolean).join(" ").trim();

  return (
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(query)
  );
}

const SHOW_YOUTUBE_EXPORT_DEBUG =
  process.env.NEXT_PUBLIC_SHOW_EXPORT_DEBUG === "true";

const PUBLIC_BETA_SHOWCASE_MIXLIST_ID =
  "bb61509f-c6ed-4b2f-9f7e-6834a96ccdda";

const PUBLIC_BETA_CLOSING_NOTE =
  "Groovara is still a work in progress, and we're looking for people who love music and would like to help us make it better. We're opening our beta to a small group of people who want to help shape what comes next. If this feels like something you'd like to be part of, click below to raise your hand.\n\nYou're welcome to stick around for another listen, take the songs with you, pass this along to someone who loves music, or come help us build what's next.\n\nWhatever you decide, we're glad you're here.";

function openExternalExportUrl(url: string) {
  const opened = window.open(url, "_blank");

  if (opened) {
    try {
      opened.opener = null;
    } catch {}
    return;
  }

  // Async export requests can cause browsers to block a new tab.
  // Falling back to same-tab navigation guarantees the exported playlist opens.
  window.location.assign(url);
}

export default function MixlistPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const mixlistId = String(id);
  const isPublicBetaShowcase =
    mixlistId === PUBLIC_BETA_SHOWCASE_MIXLIST_ID;

  const [mix, setMix] = useState<Mixlist | null>(null);
  const [songs, setSongs] = useState<MixSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [endExportMenuOpen, setEndExportMenuOpen] = useState(false);
  const [exportingYouTube, setExportingYouTube] = useState(false);
  const [youtubePreviewOpen, setYouTubePreviewOpen] = useState(false);
  const [youtubePreviewLoading, setYouTubePreviewLoading] = useState(false);
  const [youtubePreview, setYouTubePreview] =
    useState<YouTubeExportPreview | null>(null);
  const [youtubePreviewError, setYouTubePreviewError] =
    useState<string | null>(null);
  const [copyingToStudio, setCopyingToStudio] = useState(false);
  const [studioStatus, setStudioStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [revealedSlots, setRevealedSlots] = useState(1);
  const [clicked, setClicked] = useState<boolean[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [userId, setUserId] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const receiptTrackedRef = useRef(false);
  const openedMixlistTrackedRef = useRef(false);
  const youtubeExportResumeAttemptedRef = useRef(false);
  const [preferredPlatform, setPreferredPlatform] = useState<
    "spotify" | "youtube" | "apple"
  >("youtube");

  const [autoplayToken, setAutoplayToken] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  type Platform = "spotify" | "youtube" | "apple";

  type ConvertedTrack = {
    title: string;
    artist: string;
    platform: Platform;
    track_id: string;
    url?: string;
  };

  const [convertedActiveTrack, setConvertedActiveTrack] =
    useState<ConvertedTrack | null>(null);
  const [convertingTrack, setConvertingTrack] = useState(false);

  const handleCopyLink = async () => {
    setExportMenuOpen(false);
    try {
      const url = window.location.href;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyStatus("Copied link.");
      trackEvent("copied_mixlist_link", {
        mixlist_id: mixlistId,
        source: "mixlist_page",
      });
      window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("Couldn't copy. Copy from the address bar.");
      window.setTimeout(() => setCopyStatus(null), 2500);
    }
  };

  const handleEditInStudio = async () => {
    if (copyingToStudio) return;

    setCopyingToStudio(true);
    setStudioStatus(null);

    const result = await copyMixlistToStudioAction({ mixlistId });

    if (!result.ok) {
      setCopyingToStudio(false);
      setStudioStatus(result.message);
      return;
    }

    trackEvent("copied_mixlist_to_studio", {
      source_mixlist_id: mixlistId,
      new_tracklist_id: result.tracklistId,
      is_owner: Boolean(userId && mix?.owner_user_id === userId),
      song_count: songs.length,
    });

    router.push(`/tracklists/${result.tracklistId}`);
  };

  const handleExportSpotify = async () => {
    setExportMenuOpen(false);

    try {
      const res = await fetch("/api/spotify/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mixlistId,
        }),
      });

      const data = await res.json();

      if (
        (res.status === 409 || res.status === 401) &&
        data?.connectUrl
      ) {
        window.location.href = data.connectUrl;
        return;
      }

      if (!res.ok) {
        const codeSuffix = data?.code ? " (" + data.code + ")" : "";
        alert((data?.error ?? "Spotify export failed.") + codeSuffix);
        return;
      }

      trackEvent("exported_playlist", {
        mixlist_id: mixlistId,
        platform: "spotify",
        song_count: songs.length,
      });

      if (data?.playlistUrl) {
        openExternalExportUrl(data.playlistUrl);
      } else {
        alert("Exported to Spotify.");
      }
    } catch (error) {
      console.error("Spotify export failed", error);
      alert("Spotify export failed.");
    }
  };

  const closeYouTubeExportPreview = () => {
    if (exportingYouTube) return;
    setYouTubePreviewOpen(false);
    setYouTubePreviewLoading(false);
    setYouTubePreview(null);
    setYouTubePreviewError(null);
  };

  const openYouTubeExportPreview = async () => {
    if (youtubePreviewLoading || exportingYouTube) return;

    setExportMenuOpen(false);
    setYouTubePreviewOpen(true);
    setYouTubePreviewLoading(true);
    setYouTubePreview(null);
    setYouTubePreviewError(null);

    try {
      const response = await fetch("/api/youtube/export/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mixlistId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setYouTubePreviewError(
          data?.error ?? "YouTube export preview failed.",
        );
        return;
      }

      const preview = data as YouTubeExportPreview;

      trackEvent("opened_youtube_export_preview", {
        mixlist_id: mixlistId,
        song_count: Number(preview.songCount ?? songs.length),
        matched_count: Number(preview.matchedCount ?? 0),
        estimated_search_requests: Number(
          preview.estimatedSearchRequests ?? 0,
        ),
      });

      const everythingMatched =
        preview.songCount > 0 &&
        preview.matchedCount === preview.songCount &&
        preview.searchRequiredCount === 0 &&
        preview.unresolvedCount === 0;

      if (everythingMatched) {
        setYouTubePreviewOpen(false);
        setYouTubePreviewLoading(false);
        setYouTubePreview(null);
        setCopyStatus("Preparing YouTube playlist...");

        // Every song is already cached, so matched-only is the safest path:
        // it guarantees this happy-path export cannot spend search requests.
        await executeYouTubeExport("matched_only");
        return;
      }

      setYouTubePreview(preview);
    } catch (error) {
      console.error("YouTube export preview failed", error);
      setYouTubePreviewError("YouTube export preview failed.");
    } finally {
      setYouTubePreviewLoading(false);
    }
  };

  const executeYouTubeExport = async (mode: YouTubeExportMode) => {
    if (exportingYouTube) return;

    setExportingYouTube(true);
    setYouTubePreviewError(null);
    setCopyStatus(
      mode === "matched_only"
        ? "Exporting matched songs to YouTube..."
        : "Finding matches and preparing YouTube playlist...",
    );

    try {
      const res = await fetch("/api/youtube/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mixlistId,
          mode,
        }),
      });

      const data = await res.json();

      if (
        (res.status === 409 || res.status === 401) &&
        (data?.connectUrl || data?.loginUrl)
      ) {
        window.location.href = data.connectUrl ?? data.loginUrl;
        return;
      }

      if (!res.ok) {
        const exportedCount = Number(data?.exportedCount ?? 0);

        if (data?.playlistUrl && exportedCount > 0) {
          openExternalExportUrl(data.playlistUrl);
        }

        const codeSuffix = data?.code ? " (" + data.code + ")" : "";
        setYouTubePreviewError(
          (data?.error ?? "YouTube export failed.") + codeSuffix,
        );
        setCopyStatus(null);
        return;
      }

      trackEvent("exported_playlist", {
        mixlist_id: mixlistId,
        platform: "youtube",
        export_mode: mode,
        song_count: songs.length,
        exported_count: data?.exportedCount ?? 0,
        skipped_count: data?.skippedCount ?? 0,
        search_requests: data?.searchRequests ?? 0,
      });

      const exportedCount = Number(data?.exportedCount ?? 0);
      const skippedCount = Number(data?.skippedCount ?? 0);
      setCopyStatus(
        skippedCount > 0
          ? "Exported " + exportedCount + "; skipped " + skippedCount + "."
          : "Exported " +
            exportedCount +
            " song" +
            (exportedCount === 1 ? "" : "s") +
            ".",
      );
      window.setTimeout(() => setCopyStatus(null), 3500);

      setYouTubePreviewOpen(false);
      setYouTubePreview(null);
      setYouTubePreviewError(null);

      if (data?.playlistUrl) {
        openExternalExportUrl(data.playlistUrl);
      }
    } catch (error) {
      console.error("YouTube export failed", error);
      setYouTubePreviewError("YouTube export failed.");
      setCopyStatus(null);
    } finally {
      setExportingYouTube(false);
    }
  };

  useEffect(() => {
    if (!youtubePreviewOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exportingYouTube) {
        closeYouTubeExportPreview();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubePreviewOpen, exportingYouTube]);

  useEffect(() => {
    if (loading || youtubeExportResumeAttemptedRef.current) return;

    const query = new URLSearchParams(window.location.search);
    if (
      query.get("youtube") !== "connected" ||
      query.get("resumeYouTubeExport") !== "1"
    ) {
      return;
    }

    youtubeExportResumeAttemptedRef.current = true;
    const requestedMode = query.get("youtubeExportMode");
    const resumeMode: YouTubeExportMode =
      requestedMode === "matched_only"
        ? "matched_only"
        : "search_missing";

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("youtube");
    cleanUrl.searchParams.delete("resumeYouTubeExport");
    cleanUrl.searchParams.delete("youtubeExportMode");
    window.history.replaceState(
      null,
      "",
      cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
    );

    void executeYouTubeExport(resumeMode);
    // The ref prevents React Strict Mode from resuming the export twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mixlistId]);

  useEffect(() => {
    receiptTrackedRef.current = false;
    openedMixlistTrackedRef.current = false;
  }, [mixlistId]);

  // Optional user identity for per-user progress.
  // If anonymous, page should still render; progress just won’t persist.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            try {
              await supabase.auth.signOut({ scope: "local" });
            } catch {
              // The local session is already unusable. Public Mixlists should
              // still continue anonymously even if cleanup itself fails.
            }
          }

          setUserId(null);
          return;
        }

        setUserId(data?.user?.id ?? null);
      } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {}
        }

        if (!cancelled) {
          setUserId(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  // Opening someone else's Mixlist while signed in adds it to Received.
  useEffect(() => {
    if (loading) return;
    if (!userId || !mix?.owner_user_id) return;
    if (userId === mix.owner_user_id) return;
    if (receiptTrackedRef.current) return;

    receiptTrackedRef.current = true;

    const recordReceipt = async () => {
      const now = new Date().toISOString();
      const { data: existing, error: lookupError } = await supabase
        .from("mixlist_receipts")
        .select("first_opened_at")
        .eq("user_id", userId)
        .eq("mixlist_id", mixlistId)
        .maybeSingle();

      if (lookupError) {
        receiptTrackedRef.current = false;
        console.error("Failed to check Received Mixlists", lookupError);
        return;
      }

      const request = existing
        ? supabase
            .from("mixlist_receipts")
            .update({ last_opened_at: now, archived: false })
            .eq("user_id", userId)
            .eq("mixlist_id", mixlistId)
        : supabase.from("mixlist_receipts").insert({
            user_id: userId,
            mixlist_id: mixlistId,
            first_opened_at: now,
            last_opened_at: now,
            archived: false,
          });

      const { error } = await request;

      if (error) {
        receiptTrackedRef.current = false;
        console.error("Failed to add Mixlist to Received", error);
        return;
      }

      trackEvent("opened_received_mixlist", {
        mixlist_id: mixlistId,
        source: "shared_link",
        song_count: songs.length,
      });

      if (!existing) {
        trackEvent("received_mixlist_added", {
          mixlist_id: mixlistId,
          source: "shared_link",
          song_count: songs.length,
        });
      }
    };

    void recordReceipt();
  }, [loading, userId, mix?.owner_user_id, mixlistId, songs.length]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);
      setNotFound(false);
      setProgressLoaded(false);

      const { data: mixData, error: mixErr } = await publicSupabase
        .from("mixlists")
        .select(
          "id,title,message,finishing_note,reveal_mode,include_song_notes,owner_user_id",
        )
        .eq("id", mixlistId)
        .maybeSingle();

      if (cancelled) return;

      if (mixErr) {
        setErr("Couldn't load this mixlist. Please try again.");
        console.error("mixlist fetch error", mixErr);
        setLoading(false);
        return;
      }

      if (!mixData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setMix(mixData as Mixlist);

      const { data: songData, error: songErr } = await publicSupabase
        .from("mixlist_songs")
        .select("id,position,title,artist,album,url,note,platform,track_id,isrc")
        .eq("mixlist_id", mixlistId)
        .order("position", { ascending: true });

      if (cancelled) return;

      if (songErr) {
        setErr("Couldn't load songs for this mixlist. Please try again.");
        setLoading(false);
        return;
      }

      const list = (songData ?? []) as MixSong[];
      setSongs(list);

      setRevealedSlots(1);
      setClicked(new Array(list.length).fill(false));
      setSelectedIndex(0);

      setLoading(false);

      // Compliance refresh: YouTube API Data stored for songs is refreshed,
      // updated, or marked unavailable after it becomes stale.
      const refreshedList = await refreshYouTubeSongsForCompliance(list);
      if (!cancelled) {
        setSongs(refreshedList);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [mixlistId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("groovara_preferred_platform");
      if (saved === "spotify" || saved === "youtube" || saved === "apple") {
        setPreferredPlatform(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "groovara_preferred_platform",
        preferredPlatform,
      );
    } catch {}
  }, [preferredPlatform]);

  // Hydrate persisted progress if logged in
  useEffect(() => {
    const hydrate = async () => {
      if (!mix) return;

      if (!mix.reveal_mode) {
        setProgressLoaded(true);
        return;
      }

      if (songs.length === 0) {
        setProgressLoaded(true);
        return;
      }

      if (!userId) {
        setProgressLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from("mixlist_progress")
        .select("mixlist_id,user_id,revealed_count,clicked_json")
        .eq("mixlist_id", mixlistId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        const row = data as MixlistProgressRow;

        const storedSlots = Number(row.revealed_count ?? 1);
        const safeSlots = Math.max(0, Math.min(storedSlots, songs.length));

        const safeClicked = new Array(songs.length).fill(false);
        if (Array.isArray(row.clicked_json)) {
          for (
            let i = 0;
            i < Math.min(row.clicked_json.length, songs.length);
            i++
          ) {
            safeClicked[i] = row.clicked_json[i] === true;
          }
        }

        for (let i = safeSlots; i < safeClicked.length; i++)
          safeClicked[i] = false;

        setRevealedSlots(safeSlots);
        setClicked(safeClicked);
        setSelectedIndex((prev) => Math.max(0, Math.min(prev, safeSlots - 1)));
      }

      setProgressLoaded(true);
    };

    void hydrate();
  }, [mix, songs.length, userId, mixlistId]);

  // Persist progress only for logged-in users
  useEffect(() => {
    if (!progressLoaded) return;
    if (!mix?.reveal_mode) return;
    if (!userId) return;
    if (songs.length === 0) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const safeSlots = Math.max(0, Math.min(revealedSlots, songs.length));

      const safeClicked = new Array(songs.length).fill(false);
      for (let i = 0; i < Math.min(clicked.length, songs.length); i++) {
        safeClicked[i] = clicked[i] === true;
      }
      for (let i = safeSlots; i < safeClicked.length; i++)
        safeClicked[i] = false;

      await supabase.from("mixlist_progress").upsert(
        {
          mixlist_id: mixlistId,
          user_id: userId,
          revealed_count: safeSlots,
          clicked_json: safeClicked,
        },
        { onConflict: "mixlist_id,user_id" },
      );

      saveTimerRef.current = null;
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    progressLoaded,
    mix?.reveal_mode,
    userId,
    songs.length,
    revealedSlots,
    clicked,
    mixlistId,
  ]);

  const visibleCount = useMemo(() => {
    if (!mix) return 0;
    return mix.reveal_mode
      ? Math.min(revealedSlots, songs.length)
      : songs.length;
  }, [mix, revealedSlots, songs.length]);

  const visibleSongs = useMemo(
    () => songs.slice(0, visibleCount),
    [songs, visibleCount],
  );

  const safeSelectedIndex = useMemo(() => {
    if (visibleSongs.length === 0) return 0;
    return Math.max(0, Math.min(selectedIndex, visibleSongs.length - 1));
  }, [selectedIndex, visibleSongs.length]);

  const activeSong = visibleSongs[safeSelectedIndex] ?? null;
  const uiVisibleTracks = useMemo(
    () => visibleSongs.map((song, idx) => toUiTrack(song, idx)),
    [visibleSongs],
  );
  const activeUiTrack = uiVisibleTracks[safeSelectedIndex] ?? null;

  const displayUiTrack = useMemo(() => {
    if (!activeUiTrack) return null;
    if (!convertedActiveTrack) return activeUiTrack;

    return {
      ...activeUiTrack,
      title: convertedActiveTrack.title || activeUiTrack.title,
      artist: convertedActiveTrack.artist || activeUiTrack.artist,
      url: convertedActiveTrack.url ?? activeUiTrack.url,
      platform: convertedActiveTrack.platform ?? activeUiTrack.platform,
      trackId: convertedActiveTrack.track_id ?? null,
    };
  }, [activeUiTrack, convertedActiveTrack]);

  const ambientTrack = useMemo<UiTrack>(() => {
    if (displayUiTrack) return displayUiTrack;
    return {
      id: `mix-${mixlistId}`,
      title: "Mixlist",
      artist: "Groovara",
      album: null,
      image: null,
      url: null,
      platform: "other",
      durationMs: 1,
      notes: null,
      theme: createTheme(`mix-${mixlistId}`, "Mixlist", "Groovara"),
    };
  }, [displayUiTrack, mixlistId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activeSong) {
        setConvertedActiveTrack(null);
        setConvertingTrack(false);
        return;
      }

      const sourcePlatform = getPlatform(activeSong.url ?? "");
      if (
        sourcePlatform !== "spotify" &&
        sourcePlatform !== "youtube" &&
        sourcePlatform !== "apple"
      ) {
        setConvertedActiveTrack(null);
        setConvertingTrack(false);
        return;
      }

      if (sourcePlatform === preferredPlatform) {
        setConvertedActiveTrack({
          title: activeSong.title,
          artist: activeSong.artist,
          platform: sourcePlatform,
          track_id: activeSong.id,
          url: activeSong.url,
        });
        setConvertingTrack(false);
        return;
      }

      setConvertingTrack(true);

      try {
        const converted = await convertTrackPlatform(
          {
            title: activeSong.title,
            artist: activeSong.artist,
            platform: sourcePlatform,
            track_id: activeSong.id,
            url: activeSong.url,
            isrc: activeSong.isrc,
          },
          preferredPlatform,
        );

        if (!cancelled) {
          setConvertedActiveTrack(
            converted
              ? {
                  title: converted.title ?? activeSong.title,
                  artist: converted.artist ?? activeSong.artist,
                  platform: converted.platform ?? sourcePlatform,
                  track_id: converted.track_id ?? activeSong.id,
                  url: converted.url ?? activeSong.url,
                }
              : {
                  title: activeSong.title,
                  artist: activeSong.artist,
                  platform: sourcePlatform,
                  track_id: activeSong.id,
                  url: activeSong.url,
                },
          );
        }
      } catch (error) {
        console.error("mixlist platform conversion failed", error);

        if (!cancelled) {
          setConvertedActiveTrack({
            title: activeSong.title,
            artist: activeSong.artist,
            platform: sourcePlatform,
            track_id: activeSong.id,
            url: activeSong.url,
          });
        }
      } finally {
        if (!cancelled) {
          setConvertingTrack(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeSong, preferredPlatform]);

  const activeIsHidden = useMemo(() => {
    if (!mix) return false;
    if (!mix.reveal_mode) return false;
    return clicked[safeSelectedIndex] !== true;
  }, [mix, clicked, safeSelectedIndex]);

  const showFirstSongIntro = Boolean(
    mix?.reveal_mode &&
      songs.length > 0 &&
      !clicked.some((value) => value === true),
  );

  useEffect(() => {
    if (!hasInteracted) return;
    if (!activeSong) return;
    if (activeIsHidden) return;

    setAutoplayToken((v) => v + 1);
  }, [
    safeSelectedIndex,
    displayUiTrack?.url,
    hasInteracted,
    activeSong,
    activeIsHidden,
  ]);

  const revealSongAt = (index: number, source: string) => {
    if (index < 0 || index >= songs.length) return;
    if (clicked[index] === true) return;

    const nextClicked = new Array(songs.length).fill(false);
    for (let i = 0; i < songs.length; i++) {
      nextClicked[i] = clicked[i] === true;
    }
    nextClicked[index] = true;
    setClicked(nextClicked);

    const revealedCount = nextClicked.filter(Boolean).length;

    trackEvent("revealed_song", {
      mixlist_id: mixlistId,
      song_position: index + 1,
      revealed_count: revealedCount,
      total_songs: songs.length,
      source,
    });

    if (revealedCount >= songs.length) {
      trackEvent("completed_mixlist", {
        mixlist_id: mixlistId,
        total_songs: songs.length,
      });
    }
  };

  const handleRevealNext = () => {
    const nextSlots = Math.min(revealedSlots + 1, songs.length);
    const nextIndex = Math.max(0, nextSlots - 1);

    setRevealedSlots(nextSlots);
    setSelectedIndex(nextIndex);
    revealSongAt(nextIndex, "reveal_next");
  };

  const handlePrimaryReveal = () => {
    if (songs.length === 0) return;

    setHasInteracted(true);

    if (clicked[0] !== true) {
      setRevealedSlots((current) => Math.max(1, current));
      setSelectedIndex(0);
      revealSongAt(0, "reveal_first");
      return;
    }

    handleRevealNext();
  };

  const handleListenAgain = () => {
    if (songs.length === 0) return;

    setSelectedIndex(0);
    setHasInteracted(false);
    setAutoplayToken((value) => value + 1);

    if (mix?.reveal_mode) {
      setRevealedSlots(1);
      setClicked(new Array(songs.length).fill(false));
    } else {
      setClicked(new Array(songs.length).fill(false));
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    trackEvent("restarted_mixlist", {
      mixlist_id: mixlistId,
      song_count: songs.length,
    });
  };

  const showEndPanel = useMemo(() => {
    if (!mix || songs.length === 0) return false;
    if (!mix.reveal_mode) return true;

    return (
      revealedSlots === songs.length &&
      clicked[songs.length - 1] === true
    );
  }, [mix, songs.length, revealedSlots, clicked]);

  const showFinishingNote =
    showEndPanel && Boolean((mix?.finishing_note ?? "").trim());

  const noteRangeLabel = useMemo(() => {
    if (!activeSong) return "SONG";

    const noteText = (activeSong.note ?? "").trim();
    const n = safeSelectedIndex + 1;

    if (!noteText) return `SONG #${n}`;

    const matches: number[] = [];
    for (let i = 0; i < songs.length; i++) {
      const t = (songs[i].note ?? "").trim();
      if (t && t === noteText) matches.push(i + 1);
    }

    if (matches.length <= 1) return `SONG #${n}`;

    const min = Math.min(...matches);
    const max = Math.max(...matches);
    return `SONGS #${min}-#${max}`;
  }, [activeSong, safeSelectedIndex, songs]);

  useEffect(() => {
    if (loading || !mix || openedMixlistTrackedRef.current) return;

    openedMixlistTrackedRef.current = true;
    trackEvent("opened_mixlist", {
      mixlist_id: mixlistId,
      song_count: songs.length,
    });
  }, [loading, mix, mixlistId, songs.length]);

  const songNoteCard = mix?.include_song_notes ? (
    <div className="gv-row rounded-2xl border border-border p-5 text-left">
      <p className="text-xs tracking-[0.22em] text-muted-foreground">
        {noteRangeLabel}
      </p>

      {!activeSong ? (
        <p className="mt-3 text-sm text-muted-foreground">No song selected.</p>
      ) : activeIsHidden ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Reveal this song to see the note.
        </p>
      ) : (activeSong.note ?? "").trim().length > 0 ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-[#292923] dark:text-[#F4EDDD]">
          {activeSong.note}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No note for this song.
        </p>
      )}
    </div>
  ) : null;

  const descriptionBlock = mix?.message ? (
    <div className="mt-5 max-w-5xl text-left">
      <p className="whitespace-pre-wrap text-base leading-7 text-foreground/80 dark:text-[#C8BCA2]">
        {mix.message}
      </p>
    </div>
  ) : null;

  const handlePreferredPlatformChange = (nextPlatform: Platform) => {
    if (nextPlatform === preferredPlatform) return;

    trackEvent("changed_platform", {
      mixlist_id: mixlistId,
      source: "mixlist_page",
      from_platform: preferredPlatform,
      to_platform: nextPlatform,
    });

    setPreferredPlatform(nextPlatform);
  };

  const platformSelectorCard = (
    <div className="gv-row rounded-2xl p-4">
      <label className="mb-2 block text-xs tracking-[0.22em] text-muted-foreground">
        LISTEN ON
      </label>

      <select
        value={preferredPlatform}
        onChange={(e) =>
          handlePreferredPlatformChange(e.target.value as Platform)
        }
        className="w-full appearance-none rounded-full border border-purple-500/40 bg-black/70 px-4 py-3 text-sm text-white outline-none transition hover:bg-black/80"
      >
        <option value="spotify" className="bg-black text-white">
          Spotify
        </option>
        <option value="youtube" className="bg-black text-white">
          YouTube
        </option>
        <option value="apple" className="bg-black text-white">
          Apple Music
        </option>
      </select>

      {convertingTrack ? (
        <p className="mt-2 text-xs tracking-widest text-muted-foreground">
          Converting current track...
        </p>
      ) : null}
    </div>
  );

  const editInStudioCard = (
    <div className="gv-row rounded-2xl p-4">
      <button
        type="button"
        onClick={handleEditInStudio}
        disabled={copyingToStudio}
        className={purpleActionButton}
      >
        {copyingToStudio ? "COPYING TO STUDIO..." : "EDIT IN STUDIO"}
      </button>

      {studioStatus ? (
        <p className="mt-2 text-center text-xs tracking-widest text-muted-foreground">
          {studioStatus}
        </p>
      ) : null}
    </div>
  );

  const renderExportOptions = (
    closeMenu: () => void,
    placement: "up" | "down" = "up",
  ) => (
    <div
      className={`absolute right-0 z-[500] w-56 overflow-hidden rounded-2xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur ${
        placement === "up"
          ? "bottom-full mb-2"
          : "top-full mt-2"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          closeMenu();
          void handleExportSpotify();
        }}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-purple-500/10"
      >
        <span>Spotify</span>
        <span className="text-xs text-[#5B4B6E] dark:text-[#C8BCA2]">Export</span>
      </button>

      <button
        type="button"
        onClick={() => {
          closeMenu();
          void openYouTubeExportPreview();
        }}
        disabled={exportingYouTube}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>YouTube</span>
        <span className="text-xs text-[#5B4B6E] dark:text-[#C8BCA2]">
          {youtubePreviewLoading
            ? "Checking..."
            : exportingYouTube
              ? "Exporting..."
              : "Export"}
        </span>
      </button>

      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-muted-foreground opacity-70"
      >
        <span>Apple Music</span>
        <span className="text-[10px] uppercase tracking-widest">
          Coming soon
        </span>
      </button>
    </div>
  );

  const exportSelectorCard = (
    <div className="gv-row relative z-[200] overflow-visible rounded-2xl p-4">
      <label className="mb-2 block text-xs tracking-[0.22em] text-muted-foreground">
        EXPORT TO
      </label>

      <div className="relative z-[300] overflow-visible">
        <button
          type="button"
          onClick={() => setExportMenuOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-full border border-purple-500/40 bg-black/70 px-4 py-3 text-left text-sm text-white outline-none transition hover:bg-black/80"
          aria-haspopup="menu"
          aria-expanded={exportMenuOpen}
        >
          <span>Choose platform</span>
          <span aria-hidden="true" className="text-xs text-white/70">
            ▾
          </span>
        </button>

        {exportMenuOpen
          ? renderExportOptions(
              () => setExportMenuOpen(false),
              "down",
            )
          : null}
      </div>
    </div>
  );

  const copyLinkCard = (
    <div className="gv-row rounded-2xl p-4">
      <button onClick={handleCopyLink} className={purpleActionButton}>
        COPY LINK
      </button>

      {copyStatus ? (
        <p className="mt-2 text-center text-xs tracking-widest text-muted-foreground">
          {copyStatus}
        </p>
      ) : null}
    </div>
  );

  const endOfMixPanel = showEndPanel ? (
    <section className="mx-auto mt-8 max-w-4xl">
      <div className="gv-row rounded-3xl border border-purple-500/25 p-6 sm:p-7">
        {isPublicBetaShowcase ? (
          <p className="whitespace-pre-wrap text-left text-base leading-7 text-foreground/90 sm:text-lg sm:leading-8">
            {PUBLIC_BETA_CLOSING_NOTE}
          </p>
        ) : showFinishingNote ? (
          <p className="whitespace-pre-wrap text-left text-base leading-7 text-foreground/90 sm:text-lg sm:leading-8">
            {mix?.finishing_note}
          </p>
        ) : null}

        <div className={isPublicBetaShowcase || showFinishingNote ? "mt-6" : ""}>
          <Link
            href="/access"
            onClick={() =>
              trackEvent("clicked_beta_cta_from_mixlist", {
                mixlist_id: mixlistId,
                source: "mixlist_end_panel",
              })
            }
            className="inline-flex w-full items-center justify-center rounded-full border border-[#5B4B6E] bg-[#5B4B6E] px-8 py-4 text-sm font-semibold tracking-[0.18em] text-[#F4EDDD] transition hover:-translate-y-0.5 hover:bg-[#493B59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4B6E]/40 dark:border-[#C8BCA2]/35"
          >
            JOIN THE BETA
          </Link>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleListenAgain}
              className={purpleActionButton}
            >
              LISTEN AGAIN
            </button>

            <div className="relative z-50">
              <button
                type="button"
                onClick={() =>
                  setEndExportMenuOpen((open) => !open)
                }
                className={purpleActionButton}
                aria-haspopup="menu"
                aria-expanded={endExportMenuOpen}
              >
                EXPORT
              </button>

              {endExportMenuOpen
                ? renderExportOptions(
                    () => setEndExportMenuOpen(false),
                    "up",
                  )
                : null}
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className={purpleActionButton}
            >
              COPY LINK
            </button>
          </div>

          {copyStatus ? (
            <p className="mt-3 text-center text-xs tracking-widest text-muted-foreground">
              {copyStatus}
            </p>
          ) : null}

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="gv-accent font-medium underline decoration-current/30 underline-offset-4 transition hover:opacity-80"
            >
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </section>
  ) : null;

  if (loading) {
    return (
      <main className="p-10 text-foreground">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="p-6 text-foreground">
        <InlineNotice
          kind="error"
          title="Mixlist not found"
          message="This link may be wrong, deleted, or you may not have access."
        />
      </main>
    );
  }

  if (err) {
    return (
      <main className="p-6 text-foreground">
        <InlineNotice kind="error" title="Something went wrong" message={err} />
      </main>
    );
  }

  if (!mix) {
    return (
      <main className="p-6 text-foreground">
        <InlineNotice
          kind="error"
          title="Mixlist not found"
          message="This link may be wrong, deleted, or you may not have access."
        />
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden p-6 text-foreground sm:p-10"
      style={{
        background:
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark")
            ? ambientTrack != null
              ? `radial-gradient(circle at 20% 12%, ${ambientTrack.theme.accentColor}22, transparent 45%),
                 radial-gradient(circle at 80% 84%, ${ambientTrack.theme.glowColor}26, transparent 40%),
                 #1B1B19`
              : "#1B1B19"
            : undefined,
      }}
    >
      {!showEndPanel ? (
        <div className="pointer-events-none absolute inset-0">
          <TrackScene
            track={ambientTrack}
            intensity={ambientTrack.theme.intensity}
            showWords={Boolean(activeSong) && !activeIsHidden}
          />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="mx-auto max-w-5xl text-left">
          <p className="text-xs tracking-[0.25em] text-muted-foreground">
            MIXLIST
          </p>
          <h1 className="gv-accent mt-2 text-3xl font-semibold tracking-wide sm:text-4xl">
            {mix.title || "Untitled Mixlist"}
          </h1>
          {descriptionBlock}
        </header>

        {songs.length === 0 ? (
          <div className="mt-6 max-w-3xl">
            <InlineNotice
              kind="info"
              title="This mixlist is empty"
              message="The creator didn't include any songs."
            />
          </div>
        ) : null}

        <div className="mx-auto mt-6 grid max-w-5xl gap-4">
          <div>
            {showFirstSongIntro ? (
              <section className="gv-row flex min-h-[28rem] flex-col items-center justify-center rounded-3xl border border-border px-6 py-12 text-center sm:px-10">
                <p className="text-xs tracking-[0.24em] text-muted-foreground">
                  READY WHEN YOU ARE
                </p>
                <h2 className="gv-accent mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Your first song is waiting.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                  The first title and
                  artist will stay hidden until you begin.
                </p>
                <button
                  type="button"
                  onClick={handlePrimaryReveal}
                  className="mt-7 w-full max-w-sm rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest gv-accent transition hover:bg-purple-500/20"
                >
                  REVEAL FIRST SONG
                </button>
              </section>
            ) : displayUiTrack ? (
              <TrackTransition
                transitionKey={`${safeSelectedIndex}:${
                  displayUiTrack?.platform ?? "none"
                }:${displayUiTrack?.url ?? "no-url"}`}
              >
                <TrackView
                  key={`${displayUiTrack.id}:${displayUiTrack.platform}:${
                    displayUiTrack.url ?? "no-url"
                  }:${autoplayToken}`}
                  track={displayUiTrack}
                  isActive={true}
                  isRevealed={!activeIsHidden}
                  showNotes={false}
                  notes={activeSong?.note}
                  autoplay={hasInteracted}
                  onReveal={() => {
                    setHasInteracted(true);
                    setSelectedIndex(safeSelectedIndex);

                    if (mix.reveal_mode) {
                      revealSongAt(safeSelectedIndex, "player_reveal");
                    }
                  }}
                  disabledReason={
                    activeIsHidden ? "Reveal this song to play it." : null
                  }
                  onPrev={() => {
                    setHasInteracted(true);
                    setSelectedIndex(Math.max(0, safeSelectedIndex - 1));
                  }}
                  onNext={() => {
                    setHasInteracted(true);

                    const nextIndex = Math.min(
                      songs.length - 1,
                      safeSelectedIndex + 1,
                    );

                    if (nextIndex === safeSelectedIndex) return;

                    if (mix.reveal_mode) {
                      setRevealedSlots((current) =>
                        Math.max(current, nextIndex + 1),
                      );
                      revealSongAt(nextIndex, "player_reveal_next");
                    }

                    setSelectedIndex(nextIndex);
                  }}
                  prevLabel="PREVIOUS SONG"
                  nextLabel={mix.reveal_mode ? "REVEAL NEXT" : "NEXT SONG"}
                  disabledPrev={safeSelectedIndex === 0}
                  disabledNext={safeSelectedIndex >= songs.length - 1}
                />
              </TrackTransition>
            ) : (
              <div className="gv-row rounded-3xl p-6 text-sm text-muted-foreground">
                Select a song to begin.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {songNoteCard}

            {isPublicBetaShowcase ? (
              platformSelectorCard
            ) : (
              <>
                <div className="relative z-[150] grid gap-4 overflow-visible sm:grid-cols-2">
                  {platformSelectorCard}
                  {exportSelectorCard}
                </div>

                <div className="relative z-0 grid gap-4 sm:grid-cols-2">
                  {copyLinkCard}
                  {editInStudioCard}
                </div>
              </>
            )}
          </aside>
        </div>

        <section className="gv-row mx-auto mt-8 max-w-5xl space-y-2 rounded-3xl p-3">
          {visibleSongs.map((song, index) => {
            const isHidden =
              mix.reveal_mode && clicked[index] !== true;

            if (isHidden) {
              return (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => {
                    setHasInteracted(true);
                    setSelectedIndex(index);
                    revealSongAt(index, "song_list");
                  }}
                  className="gv-row block w-full rounded-2xl px-4 py-4 text-left transition"
                >
                  <p className="gv-accent text-sm">
                    Song {index + 1}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click to reveal
                  </p>
                </button>
              );
            }

            return (
              <div
                key={song.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setHasInteracted(true);
                  setSelectedIndex(index);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    setHasInteracted(true);
                    setSelectedIndex(index);
                  }
                }}
                className={`gv-row rounded-2xl border px-4 py-3 transition ${
                  index === safeSelectedIndex
                    ? "ring-1 ring-[color:var(--ring)]"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="gv-accent truncate text-sm">
                      {index + 1}. {song.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {song.artist}
                      {song.album ? ` - ${song.album}` : ""}
                    </p>
                  </div>

                  <a
                    href={song.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="gv-row gv-accent flex-shrink-0 rounded-lg px-2 py-1 text-[10px] tracking-[0.2em] transition"
                  >
                    OPEN
                  </a>
                </div>
              </div>
            );
          })}
        </section>

        {endOfMixPanel}
      </div>

      {youtubePreviewOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeYouTubeExportPreview();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="youtube-export-preview-title"
            className="gv-row max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-background p-5 shadow-2xl sm:p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.24em] text-[#5B4B6E] dark:text-[#C8BCA2]">
                  YOUTUBE EXPORT
                </p>
                <h2
                  id="youtube-export-preview-title"
                  className="gv-accent mt-2 text-2xl font-semibold"
                >
                  {youtubePreview && youtubePreview.matchedCount === 0
                    ? "These songs need your help"
                    : "A few songs need your help"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeYouTubeExportPreview}
                disabled={exportingYouTube}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                aria-label="Close YouTube export preview"
              >
                CLOSE
              </button>
            </div>

            {youtubePreviewLoading ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Checking which songs are ready...
                </p>
              </div>
            ) : youtubePreviewError && !youtubePreview ? (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-[#A83B2C] dark:text-red-200">{youtubePreviewError}</p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={openYouTubeExportPreview}
                    className={purpleActionButton}
                  >
                    TRY AGAIN
                  </button>
                  <button
                    type="button"
                    onClick={closeYouTubeExportPreview}
                    className={purpleActionButton}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : youtubePreview ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-border bg-black/10 p-4 dark:bg-white/5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Groovara found YouTube versions for{" "}
                    <span className="gv-accent font-semibold">
                      {youtubePreview.matchedCount} of {youtubePreview.songCount}
                    </span>{" "}
                    songs.
                  </p>

                  {youtubePreview.searchRequiredCount > 0 &&
                  youtubePreview.canSearchAndExport ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Groovara can try to find the remaining{" "}
                      {youtubePreview.searchRequiredCount}{" "}
                      song{youtubePreview.searchRequiredCount === 1 ? "" : "s"}{" "}
                      automatically. Anything it still cannot match can be
                      searched for manually below.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      You can export the songs already found. Afterward, use the
                      links below to search YouTube and add the remaining songs
                      to the playlist yourself.
                    </p>
                  )}
                </div>

                {youtubePreviewError ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-[#A83B2C] dark:text-red-200">
                    {youtubePreviewError}
                  </div>
                ) : null}

                {youtubePreview.songs.some(
                  (song) => song.status !== "matched",
                ) ? (
                  <div className="space-y-2">
                    <p className="text-xs tracking-[0.2em] text-muted-foreground">
                      SONGS STILL NEEDED
                    </p>

                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {youtubePreview.songs
                        .filter((song) => song.status !== "matched")
                        .map((song) => (
                          <div
                            key={song.position + ":" + song.title + ":" + song.artist}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-black/10 px-3 py-3 dark:bg-white/5"
                          >
                            <div className="min-w-0">
                              <p className="gv-accent truncate text-sm">
                                {song.position}. {song.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {song.artist}
                              </p>
                            </div>

                            <a
                              href={buildManualYouTubeSearchUrl(
                                song.title,
                                song.artist,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-[10px] tracking-widest gv-accent transition hover:bg-purple-500/20"
                            >
                              SEARCH YOUTUBE
                            </a>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {SHOW_YOUTUBE_EXPORT_DEBUG ? (
                  <details className="rounded-2xl border border-border p-4">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      Internal export details
                    </summary>

                    <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-black/10 p-2 dark:bg-white/5">
                          <p className="gv-accent text-lg font-semibold">
                            {youtubePreview.matchedCount}
                          </p>
                          <p>Matched</p>
                        </div>
                        <div className="rounded-xl bg-black/10 p-2 dark:bg-white/5">
                          <p className="gv-accent text-lg font-semibold">
                            {youtubePreview.searchRequiredCount}
                          </p>
                          <p>Need search</p>
                        </div>
                        <div className="rounded-xl bg-black/10 p-2 dark:bg-white/5">
                          <p className="gv-accent text-lg font-semibold">
                            {youtubePreview.unresolvedCount}
                          </p>
                          <p>Unresolved</p>
                        </div>
                      </div>

                      <p>
                        Automatic budget: {youtubePreview.budget.used} /{" "}
                        {youtubePreview.budget.dailyLimit} used;{" "}
                        {youtubePreview.budget.remaining} remaining.
                      </p>
                      <p>
                        Estimated searches: {youtubePreview.estimatedSearchRequests}.
                      </p>
                      <p>
                        Budget resets{" "}
                        {formatYouTubeBudgetReset(
                          youtubePreview.budget.resetsAt,
                        )}.
                      </p>
                    </div>
                  </details>
                ) : null}

                <div className="space-y-3 pt-1">
                  {youtubePreview.searchRequiredCount > 0 &&
                  youtubePreview.canSearchAndExport ? (
                    <button
                      type="button"
                      onClick={() =>
                        void executeYouTubeExport("search_missing")
                      }
                      disabled={exportingYouTube}
                      className={purpleActionButton}
                    >
                      {exportingYouTube
                        ? "EXPORTING..."
                        : "FIND MISSING SONGS AND EXPORT"}
                    </button>
                  ) : null}

                  {youtubePreview.canExportMatchedOnly ? (
                    <button
                      type="button"
                      onClick={() =>
                        void executeYouTubeExport("matched_only")
                      }
                      disabled={exportingYouTube}
                      className={purpleActionButton}
                    >
                      {exportingYouTube
                        ? "EXPORTING..."
                        : "EXPORT " +
                          youtubePreview.matchedCount +
                          " FOUND SONG" +
                          (youtubePreview.matchedCount === 1 ? "" : "S")}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={closeYouTubeExportPreview}
                    disabled={exportingYouTube}
                    className="w-full px-4 py-2 text-xs tracking-widest text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}