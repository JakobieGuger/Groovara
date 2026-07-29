"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "../../lib/supabaseClient";
import InlineNotice from "../../lib/InlineNotice";
import { deleteTracklistAction, importSpotifyTracklistAction } from "../tracklists/actions";

type StudioSection = "progress" | "sent" | "received";
type ImportPlatform = "spotify" | "youtube" | "apple";

const IMPORT_PLATFORM_COPY: Record<
  ImportPlatform,
  {
    label: string;
    helper: string;
    placeholder: string;
    disabled?: boolean;
  }
> = {
  spotify: {
    label: "Spotify",
    helper: "Paste a public Spotify playlist URL to turn it into a Studio draft.",
    placeholder: "https://open.spotify.com/playlist/...",
  },
  youtube: {
    label: "YouTube",
    helper: "Paste a public YouTube playlist URL to turn it into a Studio draft.",
    placeholder: "https://www.youtube.com/playlist?list=...",
  },
  apple: {
    label: "Apple Music",
    helper: "Paste a public Apple Music playlist URL to turn it into a Studio draft.",
    placeholder: "https://music.apple.com/us/playlist/...",
  },
};

type ImportedPlaylistTrack = {
  platform: "spotify" | "youtube" | "apple";
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  thumbnail_url?: string | null;
  channel_title?: string | null;
};

type Tracklist = {
  id: string;
  user_id?: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at?: string | null;
  status?: "draft" | "published" | "archived";
};

type Mixlist = {
  id: string;
  owner_user_id?: string;
  title: string;
  created_at: string;
  updated_at?: string | null;
};

type MixlistReceipt = {
  mixlist_id: string;
  first_opened_at: string;
  last_opened_at: string;
  archived: boolean;
};

type SentMixlistArchive = {
  mixlist_id: string;
};

type ReceivedMixlist = Mixlist & {
  first_opened_at: string;
  last_opened_at: string;
  revealed_count: number;
};

type TracklistSongSummary = {
  tracklist_id: string;
  note: string | null;
};

type MixlistSongSummary = {
  mixlist_id: string;
  note: string | null;
};

type MixlistProgress = {
  mixlist_id: string;
  revealed_count: number;
  updated_at: string;
};

type CountSummary = {
  songs: number;
  notes: number;
};

function getActionError(result: {
  type: string;
  message?: string;
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}) {
  if (result.type === "validation") {
    return (
      result.formErrors?.[0] ??
      Object.values(result.fieldErrors ?? {})
        .flat()
        .find(Boolean) ??
      "Invalid request."
    );
  }

  return result.message ?? "Something went wrong.";
}

function buildCounts<T extends { note: string | null }>(
  rows: T[],
  getId: (row: T) => string,
) {
  const result = new Map<string, CountSummary>();

  for (const row of rows) {
    const id = getId(row);
    const current = result.get(id) ?? { songs: 0, notes: 0 };
    current.songs += 1;
    if ((row.note ?? "").trim()) current.notes += 1;
    result.set(id, current);
  }

  return result;
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function metadataLine(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" • ");
}

function GroovaraRingMark({
  className,
}: {
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none block ${className}`}
      style={{
        WebkitMaskImage: 'url("/groovara-rings-3-2-mask.png")',
        maskImage: 'url("/groovara-rings-3-2-mask.png")',
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export default function StudioHubClient() {
  const [activeSection, setActiveSection] = useState<StudioSection>("progress");
  const [drafts, setDrafts] = useState<Tracklist[]>([]);
  const [sent, setSent] = useState<Mixlist[]>([]);
  const [received, setReceived] = useState<ReceivedMixlist[]>([]);
  const [tracklistCounts, setTracklistCounts] = useState<
    Map<string, CountSummary>
  >(new Map());
  const [mixlistCounts, setMixlistCounts] = useState<Map<string, CountSummary>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPlatform, setImportPlatform] = useState<ImportPlatform>("spotify");
  const [importUrl, setImportUrl] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const initialTabTrackedRef = useRef(false);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");

    if (tab === "sent" || tab === "received") {
      setActiveSection(tab);
    }
  }, []);

  const load = async () => {
    setErr(null);
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user)
        throw new Error("You need to be signed in to open the Studio.");

      const [draftResult, sentResult, receiptResult, sentArchiveResult] =
        await Promise.all([
          supabase
            .from("tracklists")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "draft")
            .order("created_at", { ascending: false }),
          supabase
            .from("mixlists")
            .select("*")
            .eq("owner_user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("mixlist_receipts")
            .select("mixlist_id,first_opened_at,last_opened_at,archived")
            .eq("user_id", user.id)
            .eq("archived", false)
            .order("last_opened_at", { ascending: false }),
          supabase
            .from("sent_mixlist_archives")
            .select("mixlist_id")
            .eq("user_id", user.id),
        ]);

      if (draftResult.error) throw draftResult.error;
      if (sentResult.error) throw sentResult.error;
      if (receiptResult.error) throw receiptResult.error;
      if (sentArchiveResult.error) throw sentArchiveResult.error;

      const nextDrafts = ((draftResult.data ?? []) as Tracklist[]).sort(
        (a, b) => {
          const aTime = new Date(a.updated_at ?? a.created_at).getTime();
          const bTime = new Date(b.updated_at ?? b.created_at).getTime();
          return bTime - aTime;
        },
      );
      const archivedSentIds = new Set(
        ((sentArchiveResult.data ?? []) as SentMixlistArchive[]).map(
          (archive) => archive.mixlist_id,
        ),
      );
      const nextSent = ((sentResult.data ?? []) as Mixlist[]).filter(
        (mixlist) => !archivedSentIds.has(mixlist.id),
      );
      const receipts = (receiptResult.data ?? []) as MixlistReceipt[];
      const receivedIds = receipts.map((receipt) => receipt.mixlist_id);

      let nextReceived: ReceivedMixlist[] = [];
      let progressRows: MixlistProgress[] = [];

      if (receivedIds.length > 0) {
        const [receivedMixlistsResult, progressResult] = await Promise.all([
          supabase.from("mixlists").select("*").in("id", receivedIds),
          supabase
            .from("mixlist_progress")
            .select("mixlist_id,revealed_count,updated_at")
            .eq("user_id", user.id)
            .in("mixlist_id", receivedIds),
        ]);

        if (receivedMixlistsResult.error) throw receivedMixlistsResult.error;
        if (!progressResult.error) {
          progressRows = (progressResult.data ?? []) as MixlistProgress[];
        }

        const mixlistById = new Map(
          ((receivedMixlistsResult.data ?? []) as Mixlist[]).map((mixlist) => [
            mixlist.id,
            mixlist,
          ]),
        );
        const progressById = new Map(
          progressRows.map((progress) => [progress.mixlist_id, progress]),
        );

        nextReceived = receipts.flatMap((receipt) => {
          const mixlist = mixlistById.get(receipt.mixlist_id);
          if (!mixlist) return [];

          return [
            {
              ...mixlist,
              first_opened_at: receipt.first_opened_at,
              last_opened_at: receipt.last_opened_at,
              revealed_count:
                progressById.get(receipt.mixlist_id)?.revealed_count ?? 0,
            },
          ];
        });
      }

      const draftIds = nextDrafts.map((tracklist) => tracklist.id);
      const mixlistIds = Array.from(
        new Set([...nextSent.map((mixlist) => mixlist.id), ...receivedIds]),
      );

      let nextTracklistCounts = new Map<string, CountSummary>();
      let nextMixlistCounts = new Map<string, CountSummary>();

      if (draftIds.length > 0) {
        const { data, error } = await supabase
          .from("tracklist_songs")
          .select("tracklist_id,note")
          .in("tracklist_id", draftIds);

        if (error) throw error;

        nextTracklistCounts = buildCounts(
          (data ?? []) as TracklistSongSummary[],
          (song) => song.tracklist_id,
        );
      }

      if (mixlistIds.length > 0) {
        // Sent can contain far more Mixlists than the other Studio tabs.
        // Load song summaries in small batches so one large `.in()` request
        // cannot fail or return only a partial set of rows.
        const MIXLIST_COUNT_BATCH_SIZE = 20;
        const countBatches: string[][] = [];

        for (
          let start = 0;
          start < mixlistIds.length;
          start += MIXLIST_COUNT_BATCH_SIZE
        ) {
          countBatches.push(
            mixlistIds.slice(start, start + MIXLIST_COUNT_BATCH_SIZE),
          );
        }

        const countResults = await Promise.all(
          countBatches.map((batchIds) =>
            supabase
              .from("mixlist_songs")
              .select("mixlist_id,note")
              .in("mixlist_id", batchIds),
          ),
        );

        const mixlistSongRows: MixlistSongSummary[] = [];

        for (const result of countResults) {
          if (result.error) throw result.error;

          mixlistSongRows.push(
            ...((result.data ?? []) as MixlistSongSummary[]),
          );
        }

        nextMixlistCounts = buildCounts(
          mixlistSongRows,
          (song) => song.mixlist_id,
        );
      }

      setDrafts(nextDrafts);
      setSent(nextSent);
      setReceived(nextReceived);
      setTracklistCounts(nextTracklistCounts);
      setMixlistCounts(nextMixlistCounts);
    } catch (error: unknown) {
      console.error("Studio load failed", error);
      setErr(
        error instanceof Error ? error.message : "Couldn’t load the Studio.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  useEffect(() => {
    if (!actionMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenuOpen]);

  const remove = async (id: string) => {
    if (!confirm("Delete this draft?")) return;

    const result = await deleteTracklistAction({ tracklistId: id });
    if (!result.ok) {
      setErr(getActionError(result));
      return;
    }

    setDrafts((previous) =>
      previous.filter((tracklist) => tracklist.id !== id),
    );

    trackEvent("deleted_tracklist", {
      tracklist_id: id,
      source: "studio_in_progress",
    });
  };

  const removeSentFromList = async (mixlistId: string) => {
    if (
      !confirm(
        "Remove this Mixlist from Sent? The shared Mixlist and its link will keep working.",
      )
    ) {
      return;
    }

    setRemovingKey(`sent:${mixlistId}`);
    setErr(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("You need to be signed in.");

      const { error } = await supabase.from("sent_mixlist_archives").upsert(
        {
          user_id: user.id,
          mixlist_id: mixlistId,
          archived_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,mixlist_id",
        },
      );

      if (error) throw error;

      setSent((previous) =>
        previous.filter((mixlist) => mixlist.id !== mixlistId),
      );

      trackEvent("removed_sent_mixlist", {
        mixlist_id: mixlistId,
        source: "studio_sent_tab",
      });
    } catch (error: unknown) {
      console.error("Could not remove sent Mixlist from Studio", error);
      setErr(
        error instanceof Error
          ? error.message
          : "Couldn’t remove this Mixlist from Sent.",
      );
    } finally {
      setRemovingKey(null);
    }
  };

  const removeReceivedFromList = async (mixlistId: string) => {
    if (
      !confirm(
        "Remove this Mixlist from Received? You can add it back by opening its shared link again.",
      )
    ) {
      return;
    }

    setRemovingKey(`received:${mixlistId}`);
    setErr(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("You need to be signed in.");

      const { error } = await supabase
        .from("mixlist_receipts")
        .update({
          archived: true,
          last_opened_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("mixlist_id", mixlistId);

      if (error) throw error;

      setReceived((previous) =>
        previous.filter((mixlist) => mixlist.id !== mixlistId),
      );

      trackEvent("removed_received_mixlist", {
        mixlist_id: mixlistId,
        source: "studio_received_tab",
      });
    } catch (error: unknown) {
      console.error("Could not remove received Mixlist from Studio", error);
      setErr(
        error instanceof Error
          ? error.message
          : "Couldn’t remove this Mixlist from Received.",
      );
    } finally {
      setRemovingKey(null);
    }
  };

  const runPlaylistImport = async () => {
    setImportErr(null);

    const url = importUrl.trim();
    if (!url) {
      setImportErr(`Paste a ${IMPORT_PLATFORM_COPY[importPlatform].label} playlist URL.`);
      return;
    }

    setImportBusy(true);
    try {
      const endpoint =
        importPlatform === "spotify"
          ? "/api/spotify/playlist"
          : importPlatform === "youtube"
            ? "/api/youtube/import"
            : "/api/apple/import";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Import failed.");

      const playlistName: string = json.playlist?.name ?? "Imported Playlist";
      const playlistDescription: string | null =
        json.playlist?.description ?? null;

      const tracks: ImportedPlaylistTrack[] = Array.isArray(json.tracks)
        ? (json.tracks as ImportedPlaylistTrack[])
        : [];

      if (tracks.length === 0) {
        throw new Error("No tracks found. Is the playlist public?");
      }

      const result = await importSpotifyTracklistAction({
        playlistName,
        playlistDescription,
        tracks,
      } as never);

      if (!result.ok) throw new Error(getActionError(result));

      trackEvent(
        importPlatform === "spotify"
          ? "imported_spotify_playlist"
          : importPlatform === "youtube"
            ? "imported_youtube_playlist"
            : "imported_apple_playlist",
        {
          tracklist_id: result.tracklistId,
          song_count: tracks.length,
          truncated: Boolean(json.truncated),
        },
      );

      setImportOpen(false);
      setImportUrl("");
      window.location.href = `/tracklists/${result.tracklistId}`;
    } catch (error: unknown) {
      console.error(error);
      setImportErr(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const sectionCount = {
    progress: drafts.length,
    sent: sent.length,
    received: received.length,
  };

  const currentCount = sectionCount[activeSection];

  useEffect(() => {
    if (loading || err || initialTabTrackedRef.current) return;

    initialTabTrackedRef.current = true;
    trackEvent("studio_tab_viewed", {
      tab:
        activeSection === "progress"
          ? "in_progress"
          : activeSection,
      item_count: currentCount,
    });
  }, [loading, err, activeSection, currentCount]);

  const handleSectionChange = (section: StudioSection) => {
    if (section === activeSection) return;

    setActiveSection(section);

    const url = new URL(window.location.href);

    if (section === "progress") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", section);
    }

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );

    trackEvent("studio_tab_viewed", {
      tab: section === "progress" ? "in_progress" : section,
      item_count: sectionCount[section],
    });
  };

  const sectionTitle = useMemo(() => {
    if (activeSection === "progress") return "IN PROGRESS";
    if (activeSection === "sent") return "SENT";
    return "RECEIVED";
  }, [activeSection]);

  const renderCount = (count: number) =>
    `${count} ${count === 1 ? "MIXLIST" : "MIXLISTS"}`;

  return (
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content mx-auto max-w-6xl px-5 pb-16 pt-24 sm:px-8 lg:px-12">
        <div className="flex items-center justify-start">
          <div ref={actionMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setActionMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={actionMenuOpen}
              className="inline-flex min-h-11 items-center gap-3 rounded-full border border-[#57577F]/35 bg-[#57577F] px-5 py-2.5 text-[11px] font-semibold tracking-[0.18em] text-[#fff8ec] shadow-[0_10px_26px_rgba(87,87,127,0.22)] transition hover:-translate-y-0.5 hover:bg-[#49496d] hover:shadow-[0_14px_30px_rgba(87,87,127,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/40 dark:border-[#CED7DF]/20 dark:bg-[#57577F] dark:text-white dark:hover:bg-[#66668f] dark:focus-visible:ring-[#CED7DF]/40"
            >
              NEW MIXLIST
              <span
                aria-hidden="true"
                className={`text-[10px] transition-transform ${
                  actionMenuOpen ? "rotate-180" : "rotate-0"
                }`}
              >
                ▾
              </span>
            </button>

            {actionMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-3 w-56 overflow-hidden rounded-2xl border border-[#cfc3ad] bg-[#fff8ec]/98 p-2 text-[#292521] shadow-[0_18px_42px_rgba(64,47,31,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111113]/98 dark:text-white dark:shadow-[0_18px_42px_rgba(0,0,0,0.42)]"
              >
                <Link
                  href="/tracklists/new"
                  role="menuitem"
                  onClick={() => {
                    setActionMenuOpen(false);
                    trackEvent("studio_create_selected", {
                      source: "studio_action_menu",
                    });
                  }}
                  className="block rounded-xl px-4 py-3 transition hover:bg-[#57577F]/10 hover:text-[#3f3f63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/30 dark:hover:bg-white/10 dark:hover:text-[#CED7DF] dark:focus-visible:ring-[#CED7DF]/30"
                >
                  <span className="block text-sm font-semibold tracking-[0.04em]">
                    Create
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-[#6b635b] dark:text-white/45">
                    Start a blank Studio draft.
                  </span>
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setImportOpen(true);
                    trackEvent("studio_import_selected", {
                      source: "studio_action_menu",
                    });
                  }}
                  className="mt-1 block w-full rounded-xl px-4 py-3 text-left transition hover:bg-[#57577F]/10 hover:text-[#3f3f63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/30 dark:hover:bg-white/10 dark:hover:text-[#CED7DF] dark:focus-visible:ring-[#CED7DF]/30"
                >
                  <span className="block text-sm font-semibold tracking-[0.04em]">
                    Import
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-[#6b635b] dark:text-white/45">
                    Bring in a public playlist.
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <nav
          aria-label="Studio sections"
          className="mt-8 grid grid-cols-1 border-y border-[#6a6258]/20 sm:grid-cols-3 dark:border-white/10"
        >
          {(
            [
              ["progress", "IN PROGRESS"],
              ["sent", "SENT"],
              ["received", "RECEIVED"],
            ] as Array<[StudioSection, string]>
          ).map(([section, label]) => {
            const active = activeSection === section;

            return (
              <button
                key={section}
                type="button"
                onClick={() => handleSectionChange(section)}
                className={`group relative min-h-28 overflow-hidden px-4 py-6 text-left transition sm:text-center ${
                  active
                    ? "text-[#302b31] dark:text-[#f4eef7]"
                    : "text-[#7b746c] hover:text-[#57577F] dark:text-white/45 dark:hover:text-[#CED7DF]"
                }`}
              >
                {active ? (
                  <GroovaraRingMark className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 bg-[#57577F]/[0.055] dark:bg-[#CED7DF]/[0.05]" />
                ) : null}

                <span className="relative block text-xl font-medium tracking-[0.08em] sm:text-2xl">
                  {label}
                </span>
                <span className="relative mt-2 block text-[9px] tracking-[0.24em] opacity-65">
                  {renderCount(sectionCount[section])}
                </span>
              </button>
            );
          })}
        </nav>

        {loading ? (
          <p className="mx-auto mt-16 max-w-3xl text-sm text-muted-foreground">
            Loading the Studio…
          </p>
        ) : null}

        {err ? (
          <div className="mx-auto mt-10 max-w-3xl">
            <InlineNotice
              kind="error"
              title="Couldn’t load the Studio"
              message={err}
            />
          </div>
        ) : null}

        {!loading && !err ? (
          <section className="relative mx-auto mt-16 max-w-3xl">
            <GroovaraRingMark className="absolute -left-52 -top-28 hidden h-72 w-72 bg-[#57577F]/[0.04] lg:block dark:bg-[#CED7DF]/[0.035]" />

            <div className="relative">
              <h1 className="text-3xl font-medium tracking-[0.08em] text-[#302b31] dark:text-[#f4eef7] sm:text-4xl">
                {sectionTitle}
              </h1>
              <p className="mt-2 text-[10px] tracking-[0.25em] text-[#6b635b] dark:text-white/45">
                {renderCount(currentCount)}
              </p>

              <div className="mt-10 border-t border-[#6a6258]/25 dark:border-white/10">
                {activeSection === "progress"
                  ? drafts.map((tracklist) => {
                      const counts = tracklistCounts.get(tracklist.id) ?? {
                        songs: 0,
                        notes: 0,
                      };
                      const edited = formatRelativeDate(
                        tracklist.updated_at ?? tracklist.created_at,
                      );

                      return (
                        <article
                          key={tracklist.id}
                          className="group flex items-start justify-between gap-5 border-b border-[#6a6258]/18 py-5 dark:border-white/[0.08]"
                        >
                          <Link
                            href={`/tracklists/${tracklist.id}`}
                            onClick={() =>
                              trackEvent("studio_item_opened", {
                                section: "in_progress",
                                item_type: "tracklist",
                                tracklist_id: tracklist.id,
                              })
                            }
                            className="min-w-0 flex-1"
                          >
                            <h2 className="truncate text-xl font-medium text-[#292521] transition group-hover:text-[#57577F] dark:text-white/90 dark:group-hover:text-[#CED7DF] sm:text-2xl">
                              {tracklist.title}
                            </h2>
                            <p className="mt-1.5 text-xs tracking-[0.02em] text-[#6b635b] dark:text-white/45">
                              {metadataLine([
                                formatCount(counts.songs, "song"),
                                counts.notes === 0
                                  ? "No notes"
                                  : formatCount(counts.notes, "note"),
                                "Draft",
                                edited ? `Edited ${edited}` : null,
                              ])}
                            </p>
                            {tracklist.description ? (
                              <p className="mt-2 line-clamp-1 text-sm text-[#6b635b] dark:text-white/45">
                                {tracklist.description}
                              </p>
                            ) : null}
                          </Link>

                          <button
                            type="button"
                            onClick={() => remove(tracklist.id)}
                            className="mt-1 text-[10px] tracking-[0.18em] text-[#8a8178] transition hover:text-red-700 dark:text-white/35 dark:hover:text-red-300"
                          >
                            DELETE
                          </button>
                        </article>
                      );
                    })
                  : null}

                {activeSection === "sent"
                  ? sent.map((mixlist) => {
                      const counts = mixlistCounts.get(mixlist.id) ?? {
                        songs: 0,
                        notes: 0,
                      };
                      const published = formatRelativeDate(mixlist.created_at);

                      return (
                        <article
                          key={mixlist.id}
                          className="group flex items-start justify-between gap-5 border-b border-[#6a6258]/18 py-5 dark:border-white/[0.08]"
                        >
                          <Link
                            href={`/mixlists/${mixlist.id}`}
                            onClick={() =>
                              trackEvent("studio_item_opened", {
                                section: "sent",
                                item_type: "mixlist",
                                mixlist_id: mixlist.id,
                              })
                            }
                            className="min-w-0 flex-1"
                          >
                            <h2 className="truncate text-xl font-medium text-[#292521] transition group-hover:text-[#57577F] dark:text-white/90 dark:group-hover:text-[#CED7DF] sm:text-2xl">
                              {mixlist.title}
                            </h2>
                            <p className="mt-1.5 text-xs tracking-[0.02em] text-[#6b635b] dark:text-white/45">
                              {metadataLine([
                                formatCount(counts.songs, "song"),
                                counts.notes === 0
                                  ? "No notes"
                                  : formatCount(counts.notes, "note"),
                                "Sent",
                                published ? `Published ${published}` : null,
                              ])}
                            </p>
                          </Link>

                          <button
                            type="button"
                            onClick={() => void removeSentFromList(mixlist.id)}
                            disabled={removingKey === `sent:${mixlist.id}`}
                            className="mt-1 text-[10px] tracking-[0.18em] text-[#8a8178] transition hover:text-red-700 disabled:cursor-wait disabled:opacity-45 dark:text-white/35 dark:hover:text-red-300"
                          >
                            {removingKey === `sent:${mixlist.id}`
                              ? "REMOVING…"
                              : "REMOVE"}
                          </button>
                        </article>
                      );
                    })
                  : null}

                {activeSection === "received"
                  ? received.map((mixlist) => {
                      const counts = mixlistCounts.get(mixlist.id) ?? {
                        songs: 0,
                        notes: 0,
                      };
                      const listened = formatRelativeDate(
                        mixlist.last_opened_at,
                      );
                      const listeningState =
                        counts.songs > 0 &&
                        mixlist.revealed_count >= counts.songs
                          ? "Finished"
                          : mixlist.revealed_count > 0
                            ? "Started"
                            : "Unopened";

                      return (
                        <article
                          key={mixlist.id}
                          className="group flex items-start justify-between gap-5 border-b border-[#6a6258]/18 py-5 dark:border-white/[0.08]"
                        >
                          <Link
                            href={`/mixlists/${mixlist.id}`}
                            onClick={() =>
                              trackEvent("studio_item_opened", {
                                section: "received",
                                item_type: "mixlist",
                                mixlist_id: mixlist.id,
                              })
                            }
                            className="min-w-0 flex-1"
                          >
                            <h2 className="truncate text-xl font-medium text-[#292521] transition group-hover:text-[#57577F] dark:text-white/90 dark:group-hover:text-[#CED7DF] sm:text-2xl">
                              {mixlist.title}
                            </h2>
                            <p className="mt-1.5 text-xs tracking-[0.02em] text-[#6b635b] dark:text-white/45">
                              {metadataLine([
                                formatCount(counts.songs, "song"),
                                counts.notes === 0
                                  ? "No notes"
                                  : formatCount(counts.notes, "note"),
                                listeningState,
                                listened ? `Last opened ${listened}` : null,
                              ])}
                            </p>
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              void removeReceivedFromList(mixlist.id)
                            }
                            disabled={removingKey === `received:${mixlist.id}`}
                            className="mt-1 text-[10px] tracking-[0.18em] text-[#8a8178] transition hover:text-red-700 disabled:cursor-wait disabled:opacity-45 dark:text-white/35 dark:hover:text-red-300"
                          >
                            {removingKey === `received:${mixlist.id}`
                              ? "REMOVING…"
                              : "REMOVE"}
                          </button>
                        </article>
                      );
                    })
                  : null}
              </div>

              {currentCount === 0 ? (
                <div className="border-b border-[#6a6258]/18 py-10 text-sm text-[#7b746c] dark:border-white/[0.08] dark:text-white/40">
                  Nothing here yet.
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void load()}
                className="mt-8 text-[10px] tracking-[0.2em] text-[#7b746c] transition hover:text-[#57577F] dark:text-white/35 dark:hover:text-[#CED7DF]"
              >
                REFRESH
              </button>
            </div>
          </section>
        ) : null}

        {importOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-xl rounded-3xl border border-[#d1c6b3] bg-[#fff8ec] p-6 text-[#292521] shadow-2xl dark:border-white/10 dark:bg-[#111113] dark:text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-[0.2em] text-[#6b635b] dark:text-white/45">
                    IMPORT PLAYLIST
                  </p>
                  <h3 className="mt-2 text-xl font-medium">
                    Choose a platform
                  </h3>
                  <p className="mt-2 text-sm text-[#6b635b] dark:text-white/45">
                    {IMPORT_PLATFORM_COPY[importPlatform].helper}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (importBusy) return;
                    setImportOpen(false);
                    setImportErr(null);
                  }}
                  className="text-xs tracking-[0.18em] text-[#6b635b] transition hover:text-[#57577F] dark:text-white/45 dark:hover:text-[#CED7DF]"
                >
                  CLOSE
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="block text-xs tracking-[0.18em] text-[#6b635b] dark:text-white/45">
                    PLATFORM
                  </span>
                  <select
                    value={importPlatform}
                    onChange={(event) => {
                      setImportPlatform(event.target.value as ImportPlatform);
                      setImportErr(null);
                    }}
                    disabled={importBusy}
                    className="mt-2 w-full rounded-xl border border-[#57577F]/25 bg-[#57577F] px-4 py-3 text-sm font-semibold tracking-[0.08em] text-[#fff8ec] outline-none transition hover:bg-[#4b4b73] focus:border-[#57577F]/55 disabled:cursor-wait disabled:opacity-60 dark:border-[#CED7DF]/20 dark:bg-[#57577F] dark:text-white dark:hover:bg-[#66668f] dark:focus:border-[#CED7DF]/40"
                  >
                    <option value="spotify">Spotify</option>
                    <option value="youtube">YouTube</option>
                    <option value="apple">Apple Music</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs tracking-[0.18em] text-[#6b635b] dark:text-white/45">
                    PLAYLIST URL
                  </span>
                  <input
                    value={importUrl}
                    onChange={(event) => setImportUrl(event.target.value)}
                    placeholder={IMPORT_PLATFORM_COPY[importPlatform].placeholder}
                    disabled={
                      importBusy ||
                      Boolean(IMPORT_PLATFORM_COPY[importPlatform].disabled)
                    }
                    className="mt-2 w-full rounded-xl border border-[#cfc3ad] bg-white/55 px-4 py-3 text-[#292521] outline-none transition focus:border-[#57577F]/55 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-[#CED7DF]/40"
                  />
                </label>
              </div>

              {importErr ? (
                <div className="mt-4">
                  <InlineNotice
                    kind="error"
                    title="Import failed"
                    message={importErr}
                  />
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runPlaylistImport}
                  disabled={
                    importBusy ||
                    Boolean(IMPORT_PLATFORM_COPY[importPlatform].disabled)
                  }
                  className="rounded-full border border-[#57577F]/35 bg-[#57577F] px-6 py-3 text-xs font-semibold tracking-[0.18em] text-[#fff8ec] transition hover:bg-[#49496d] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#CED7DF]/20 dark:bg-[#57577F] dark:text-white dark:hover:bg-[#66668f]"
                >
                  {importBusy
                    ? "IMPORTING…"
                    : IMPORT_PLATFORM_COPY[importPlatform].disabled
                      ? "COMING NEXT"
                      : "IMPORT"}
                </button>

                <span className="text-xs tracking-[0.12em] text-[#7b746c] dark:text-white/35">
                  Public playlists work best right now.
                </span>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </main>
  );
}