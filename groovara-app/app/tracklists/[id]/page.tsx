"use client";

import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import UnifiedSearch, { UnifiedSearchResult } from "../../../lib/UnifiedSearch";
import InlineNotice from "../../../lib/InlineNotice";
import Image from "next/image";
import {
  addManualSongToTracklistAction,
  addSongToTracklistAction,
  applyTracklistNoteToSelectedAction,
  clearTracklistNoteForSelectedAction,
  clearTracklistSongNoteAction,
  createMixlistFromTracklistAction,
  moveTracklistSongAction,
  removeSongFromTracklistAction,
  saveTracklistSongNoteAction,
  updateTracklistMetadataAction,
} from "./actions";
import { deleteTracklistAction } from "../actions";
import CharacterCounter from "@/lib/CharacterCounter";

type Tracklist = {
  id: string;
  title: string;
  description: string | null;
};

type TrackSong = {
  id: string;
  tracklist_id: string;
  position: number;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  note: string | null;
  platform: string | null;
  track_id: string | null;
};

type UserSettings = {
  default_reveal_mode: boolean;
  default_include_song_notes: boolean;
  default_is_public: boolean;
};

const PLATFORM_ICONS: Record<string, string> = {
  spotify: "/icons/spotify24.png",
  youtube: "/icons/youtube24.png",
  apple: "/icons/apple24.png",
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
      Object.values(result.fieldErrors ?? {}).flat().find(Boolean) ??
      "Invalid input."
    );
  }

  return result.message ?? "Something went wrong.";
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

async function refreshTracklistYouTubeSongsForCompliance(list: TrackSong[]) {
  const songRefs = list
    .map((song) => {
      const videoId = extractYouTubeId(song.url);
      if (!videoId) return null;

      return {
        table: "tracklist_songs",
        id: song.id,
        url: song.url,
      };
    })
    .filter(
      (ref): ref is { table: "tracklist_songs"; id: string; url: string } =>
        ref !== null
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
      (data.items ?? []).map((item) => [item.video_id, item])
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
          platform: song.platform ?? "youtube",
          track_id: song.track_id ?? videoId,
        };
      }

      return {
        ...song,
        title: fresh.title ?? song.title,
        artist: fresh.channel_title ?? song.artist,
        album: song.album ?? "YouTube",
        url: fresh.youtube_url ?? song.url,
        platform: song.platform ?? "youtube",
        track_id: song.track_id ?? videoId,
      };
    });
  } catch (error) {
    console.error("YouTube metadata refresh crashed", error);
    return list;
  }
}

export default function TracklistDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [item, setItem] = useState<Tracklist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mTitle, setMTitle] = useState("");
  const [mArtist, setMArtist] = useState("");
  const [mUrl, setMUrl] = useState("");
  const [mAlbum, setMAlbum] = useState("");
  const [addingManual, setAddingManual] = useState(false);

  const [mixMsg, setMixMsg] = useState("");
  const [mixReveal, setMixReveal] = useState(true);
  const [creatingMix, setCreatingMix] = useState(false);
  const [mixFinish, setMixFinish] = useState("");
  const [mixIsPublic, setMixIsPublic] = useState(true);
  const [includeSongNotes, setIncludeSongNotes] = useState(true);

  const [pageError, setPageError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<string | null>(null);

  const DEV_MANUAL_ADD = process.env.NEXT_PUBLIC_DEV_MANUAL_ADD === "true";

  const [songs, setSongs] = useState<TrackSong[]>([]);

  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const [multiNoteMode, setMultiNoteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiNoteText, setMultiNoteText] = useState("");
  const [multiWorking, setMultiWorking] = useState(false);

  const selectedCount = selectedIds.size;

  const SONG_NOTE_LIMIT = 2000;
  const MIXLIST_MESSAGE_LIMIT = 1000;
  const FINISHING_NOTE_LIMIT = 2000;  

  const busy =
    saving ||
    addingManual ||
    creatingMix ||
    savingNoteId !== null ||
    multiWorking;

  const selectedSorted = useMemo(() => {
    const set = selectedIds;
    return songs
      .filter((s) => set.has(s.id))
      .slice()
      .sort((a, b) => a.position - b.position);
  }, [songs, selectedIds]);

  const selectedRangeLabel = useMemo(() => {
    if (!multiNoteMode || selectedSorted.length === 0) return "";
    const nums = selectedSorted.map((s) => s.position + 1);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return min === max ? `SONG #${min}` : `SONGS #${min}–${max}`;
  }, [multiNoteMode, selectedSorted]);

  const exitMultiNoteMode = () => {
    setMultiNoteMode(false);
    setSelectedIds(new Set());
    setMultiNoteText("");
  };

  const toggleSelected = (songId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const seedNoteDrafts = (list: TrackSong[]) => {
    setNoteDraftById((prev) => {
      const next: Record<string, string> = { ...prev };
      const ids = new Set(list.map((s) => s.id));

      for (const s of list) {
        if (next[s.id] === undefined) next[s.id] = s.note ?? "";
      }
      for (const key of Object.keys(next)) {
        if (!ids.has(key)) delete next[key];
      }

      return next;
    });
  };

  const loadSongs = async () => {
    const { data, error } = await supabase
      .from("tracklist_songs")
      .select("id,tracklist_id,position,title,artist,album,url,note,platform,track_id")
      .eq("tracklist_id", id)
      .order("position", { ascending: true });

    if (error) {
      setPageError("Failed to load songs. Check your connection and try Refresh.");
      return;
    }

    const list = (data ?? []) as TrackSong[];
    setSongs(list);
    seedNoteDrafts(list);

    // Compliance refresh: YouTube API Data stored for tracklist songs is
    // refreshed, updated, or marked unavailable after it becomes stale.
    const refreshedList = await refreshTracklistYouTubeSongsForCompliance(list);
    setSongs(refreshedList);
  };

  useEffect(() => {
    const loadDefaults = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("default_reveal_mode,default_include_song_notes,default_is_public")
        .eq("user_id", uid)
        .maybeSingle();

      if (error || !data) return;

      const s = data as UserSettings;
      setMixReveal(!!s.default_reveal_mode);
      setIncludeSongNotes(!!s.default_include_song_notes);
      setMixIsPublic(!!s.default_is_public);
    };

    void loadDefaults();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setPageError(null);

      const { data, error } = await supabase
        .from("tracklists")
        .select("id,title,description")
        .eq("id", id)
        .single();

      if (error) {
        setPageError("Failed to load tracklist. Returning to Tracklists.");
        router.replace("/tracklists");
        return;
      }

      const t = data as Tracklist;
      setItem(t);
      setTitle(t.title);
      setDescription(t.description ?? "");

      const { data: songData, error: songError } = await supabase
        .from("tracklist_songs")
        .select("id,tracklist_id,position,title,artist,album,url,note,platform,track_id")
        .eq("tracklist_id", id)
        .order("position", { ascending: true });

      if (songError) {
        setPageError("Failed to load songs. Check your connection and try Refresh.");
        setSongs([]);
        seedNoteDrafts([]);
      } else {
        const list = (songData ?? []) as TrackSong[];
        setSongs(list);
        seedNoteDrafts(list);

        // Compliance refresh: YouTube API Data stored for tracklist songs is
        // refreshed, updated, or marked unavailable after it becomes stale.
        const refreshedList = await refreshTracklistYouTubeSongsForCompliance(list);
        setSongs(refreshedList);
      }

      setLoading(false);
    };

    void run();
  }, [id, router]);

  useEffect(() => {
    trackEvent("opened_studio", {
      tracklist_id: id,
    });
  }, [id]);

  const save = async () => {
    if (!item) return;

    setSaving(true);

    const result = await updateTracklistMetadataAction({
      tracklistId: String(id),
      title,
      description,
    });

    setSaving(false);

    if (!result.ok) {
      alert(getActionError(result));
      return;
    }

    const trimmed = title.trim();
    const nextDescription = description.trim() || null;
    setItem({ ...item, title: trimmed, description: nextDescription });
    setTitle(trimmed);
    setDescription(nextDescription ?? "");
    alert("Saved.");
  };

  const remove = async () => {
    if (!confirm("Delete this tracklist?")) return;

    const result = await deleteTracklistAction({ tracklistId: String(id) });
    if (!result.ok) {
      alert(getActionError(result));
      return;
    }

    router.replace("/tracklists");
  };

  const addSong = async (t: UnifiedSearchResult) => {
    setPageError(null);
    setPageInfo(null);

    const result = await addSongToTracklistAction({
      tracklistId: String(id),
      platform: t.platform,
      track_id: t.track_id,
      title: t.title,
      artist: t.artist,
      album: t.album || null,
      url: t.url,
    });

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    await loadSongs();
  };

  const addManual = async () => {
    setAddingManual(true);

    const result = await addManualSongToTracklistAction({
      tracklistId: String(id),
      platform: "manual",
      track_id: `manual_${crypto.randomUUID()}`,
      title: mTitle,
      artist: mArtist,
      album: mAlbum || null,
      url: mUrl,
    });

    setAddingManual(false);

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    setMTitle("");
    setMArtist("");
    setMUrl("");
    setMAlbum("");
    await loadSongs();
  };

  const removeSong = async (songId: string) => {
    if (!confirm("Remove this song from the tracklist?")) return;

    const result = await removeSongFromTracklistAction({
      tracklistId: String(id),
      songId,
    });

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    setSelectedIds((prev) => {
      if (!prev.has(songId)) return prev;
      const n = new Set(prev);
      n.delete(songId);
      return n;
    });

    if (expandedNoteId === songId) setExpandedNoteId(null);

    await loadSongs();
  };

  const moveSong = async (songId: string, direction: "up" | "down") => {
    const result = await moveTracklistSongAction({
      tracklistId: String(id),
      songId,
      direction,
    });

    if (!result.ok) {
      alert(getActionError(result));
      await loadSongs();
      return;
    }

    await loadSongs();
  };

  const saveSingleNote = async (songId: string) => {
    const text = (noteDraftById[songId] ?? "").trim();
    setSavingNoteId(songId);
    setPageError(null);
    setPageInfo(null);

    const result = await saveTracklistSongNoteAction({
      tracklistId: String(id),
      songId,
      note: text,
    });

    setSavingNoteId(null);

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    setSongs((prev) =>
      prev.map((s) =>
        s.id === songId ? { ...s, note: text.length ? text : null } : s
      )
    );
    setPageInfo("Note saved.");
    window.setTimeout(() => setPageInfo(null), 1200);
  };

  const clearSingleNote = async (songId: string) => {
    setNoteDraftById((prev) => ({ ...prev, [songId]: "" }));
    setSavingNoteId(songId);
    setPageError(null);
    setPageInfo(null);

    const result = await clearTracklistSongNoteAction({
      tracklistId: String(id),
      songId,
      note: null,
    });

    setSavingNoteId(null);

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    setSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, note: null } : s)));
    setPageInfo("Note cleared.");
    window.setTimeout(() => setPageInfo(null), 1200);
  };

  const applyNoteToSelected = async () => {
    if (!multiNoteMode || selectedIds.size === 0) return;
    const text = multiNoteText.trim();

    setMultiWorking(true);
    setPageError(null);
    setPageInfo(null);

    const ids = Array.from(selectedIds);
    const result = await applyTracklistNoteToSelectedAction({
      tracklistId: String(id),
      songIds: ids,
      note: text,
    });

    setMultiWorking(false);

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    setSongs((prev) =>
      prev.map((s) => (selectedIds.has(s.id) ? { ...s, note: text.length ? text : null } : s))
    );

    setNoteDraftById((prev) => {
      const next = { ...prev };
      for (const songId of ids) next[songId] = text;
      return next;
    });

    setPageInfo("Applied note.");
    window.setTimeout(() => setPageInfo(null), 1200);
  };

  const clearNoteForSelected = async () => {
    if (!multiNoteMode || selectedIds.size === 0) return;

    setMultiWorking(true);
    setPageError(null);
    setPageInfo(null);

    const ids = Array.from(selectedIds);
    const result = await clearTracklistNoteForSelectedAction({
      tracklistId: String(id),
      songIds: ids,
      note: null,
    });

    setMultiWorking(false);

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    setSongs((prev) =>
      prev.map((s) => (selectedIds.has(s.id) ? { ...s, note: null } : s))
    );

    setNoteDraftById((prev) => {
      const next = { ...prev };
      for (const songId of ids) next[songId] = "";
      return next;
    });

    setMultiNoteText("");
    setPageInfo("Cleared notes.");
    window.setTimeout(() => setPageInfo(null), 1200);
  };

  const createMixlist = async () => {
    if (songs.length === 0) {
      alert("Add at least one song first.");
      return;
    }

    setCreatingMix(true);
    setPageError(null);
    setPageInfo(null);

    const mixTitle =
      item?.title?.trim()
        ? item.title.trim()
        : `Mixlist • ${new Date().toLocaleDateString()}`;

    const result = await createMixlistFromTracklistAction({
      source_tracklist_id: String(id),
      title: mixTitle,
      message: mixMsg,
      finishing_note: mixFinish,
      reveal_mode: mixReveal,
      is_public: mixIsPublic,
      include_song_notes: includeSongNotes,
      songs: songs
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((s, i) => ({
          position: i + 1,
          platform: s.platform ?? "",
          track_id: s.track_id ?? "",
          title: s.title,
          artist: s.artist,
          album: s.album,
          url: s.url,
          note: s.note,
        })),
    });



    setCreatingMix(false);

    if (!result.ok) {
      setPageError(getActionError(result));
      return;
    }

    router.push(`/mixlists/${result.mixlistId}`);
    
    trackEvent("created_mixlist", {
      tracklist_id: String(id),
      mixlist_id: String(result.mixlistId),
      song_count: songs.length,
    });
  };

  if (loading) {
    return (
      <main className="p-10">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-semibold tracking-wide text-gv-accent">{item?.title}</h1>
          </div>

          <button
            onClick={remove}
            className="text-xs tracking-widest text-gray-400 hover:text-red-300 transition"
          >
            DELETE
          </button>
        </div>

        {!loading && songs.length === 0 && !pageError && (
          <div className="mt-6">
            <InlineNotice
              kind="info"
              title="No songs yet"
              message="Add songs from Spotify/YouTube/Apple to start shaping the tracklist."
            />
          </div>
        )}

        <div className="mt-10 max-w-xl space-y-4">
          <div>
            <label className="block text-xs tracking-widest text-gv-accent">TITLE</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border gv-row border-white/10 bg-white/5 px-4 py-3 text-gv-accent outline-none focus:border-purple-500/40"
            />
          </div>

          {pageError && (
            <InlineNotice kind="error" title="Something went wrong" message={pageError} />
          )}

          {pageInfo && <InlineNotice kind="info" message={pageInfo} />}

          <div>
            <label className="block text-xs tracking-widest text-gv-accent">DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border gv-row border-white/10 bg-white/5 px-4 py-3 text-gv-accent outline-none focus:border-purple-500/40"
              rows={5}
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-gv-accent hover:bg-purple-500/20 transition disabled:opacity-50"
            >
              {saving ? "SAVING…" : "SAVE"}
            </button>

            <Link
              href="/tracklists"
              className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
            >
              ← BACK
            </Link>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between">
          <h2 className="text-lg font-light tracking-wide">Songs</h2>

          <button
            onClick={() => (multiNoteMode ? exitMultiNoteMode() : setMultiNoteMode(true))}
            className="rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-2 text-xs tracking-widest text-gv-accent hover:bg-purple-500/20 transition"
          >
            {multiNoteMode ? "EXIT MULTI-NOTE" : "MULTI-NOTE MODE"}
          </button>
        </div>

        <button
          onClick={async () => {
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession();

              const res = await fetch("/api/spotify/export", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {}),
                },
                body: JSON.stringify({ tracklistId: String(id) }),
              });

              const data: {
                success?: boolean;
                playlistUrl?: string | null;
                exportedCount?: number;
                error?: string;
              } = await res.json();

              if (!res.ok) {
                alert(data.error ?? "Export failed");
                return;
              }

              if (data.playlistUrl) {
                window.open(data.playlistUrl, "_blank", "noopener,noreferrer");
              } else {
                alert(`Exported ${data.exportedCount ?? 0} tracks. (No URL returned)`);
              }
            } catch {
              alert("Export failed");
            }
          }}
          className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-500"
        >
          Export to Spotify
        </button>
        {multiNoteMode ? (
          <div className="mt-4 max-w-xl rounded-2xl gv-row border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-widest text-gray-400">MULTI-NOTE</p>
                <p className="mt-2 text-sm text-gv-accent">
                  Select songs below, then apply one note to all of them.
                </p>
                <p className="mt-2 text-xs tracking-widest text-gray-500">
                  {selectedCount} SELECTED{selectedRangeLabel ? ` • ${selectedRangeLabel}` : ""}
                </p>
              </div>

              <button
                onClick={exitMultiNoteMode}
                className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
              >
                CLOSE
              </button>
            </div>

            <textarea
              value={multiNoteText}
              onChange={(e) => setMultiNoteText(e.target.value)}
              maxLength={SONG_NOTE_LIMIT}
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
              rows={4}
              placeholder="Write a note to apply to the selected songs…"
            />

            <CharacterCounter value={multiNoteText} max={SONG_NOTE_LIMIT} />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={applyNoteToSelected}
                disabled={multiWorking || selectedCount === 0}
                className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-gv-accent hover:bg-purple-500/20 transition disabled:opacity-50"
              >
                {multiWorking ? "APPLYING…" : "APPLY NOTE"}
              </button>

              <button
                onClick={clearNoteForSelected}
                disabled={multiWorking || selectedCount === 0}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-6 py-3 text-xs tracking-widest text-gv-accent hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {multiWorking ? "WORKING…" : "CLEAR NOTES"}
              </button>

              <span className="text-xs tracking-widest text-gray-500">
                Use checkboxes on each row.
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <div className={busy ? "opacity-50 pointer-events-none" : ""}>
            <UnifiedSearch onAdd={addSong} />
          </div>
        </div>

        {DEV_MANUAL_ADD && (
          <div className="mt-4 border border-yellow-500/30 bg-yellow-500/10 p-3 rounded-lg">
            <div className="text-xs text-yellow-300 tracking-widest mb-2">DEV ONLY</div>

            <div className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs tracking-widest text-gray-400">MANUAL ADD</p>

              <div className="mt-4 grid gap-3">
                <input
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                  placeholder="Song title"
                />

                <input
                  value={mArtist}
                  onChange={(e) => setMArtist(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                  placeholder="Artist"
                />

                <input
                  value={mAlbum}
                  onChange={(e) => setMAlbum(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                  placeholder="Album (optional)"
                />

                <input
                  value={mUrl}
                  onChange={(e) => setMUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                  placeholder="Link (Spotify / YouTube / Apple Music / etc.)"
                />

                <button
                  onClick={addManual}
                  disabled={addingManual}
                  className="mt-2 w-fit rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
                >
                  {addingManual ? "ADDING…" : "ADD SONG"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-2">
          {songs.length === 0 ? (
            <p className="text-sm text-gray-400">No songs yet. Add one above.</p>
          ) : (
            songs.map((s) => {
              const noteOpen = expandedNoteId === s.id;
              const hasNote = (s.note ?? "").trim().length > 0;
              const selected = selectedIds.has(s.id);

              return (
                <div key={s.id} className="rounded-2xl gv-row">
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 transition hover:text-purple-700 dark:hover:text-purple-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {multiNoteMode ? (
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(s.id)}
                            className="h-4 w-4 accent-purple-400 flex-shrink-0"
                          />
                        ) : null}

                        {s.platform && PLATFORM_ICONS[s.platform] ? (
                          <Image
                            src={PLATFORM_ICONS[s.platform]}
                            alt={s.platform}
                            width={24}
                            height={24}
                            className="opacity-80 flex-shrink-0"
                          />
                        ) : null}

                        <p className="truncate text-sm text-foreground dark:text-gv-accent">
                          {s.position + 1}. {s.title}
                        </p>
                      </div>

                      <p className="truncate text-xs gv-accent dark:text-gv-accent">
                        {s.artist}
                        {s.album ? ` • ${s.album}` : ""}
                      </p>
                    </a>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => setExpandedNoteId(noteOpen ? null : s.id)}
                        className="text-xs tracking-widest text-gv-accent hover:text-purple-300 transition"
                        title="Song note"
                      >
                        NOTE {noteOpen ? "▴" : "▾"}
                        {hasNote ? " •" : ""}
                      </button>

                      <button
                        onClick={() => moveSong(s.id, "up")}
                        className="text-xs tracking-widest text-gv-accent hover:text-purple-300 transition"
                        title="Move up"
                      >
                        ↑
                      </button>

                      <button
                        onClick={() => moveSong(s.id, "down")}
                        className="text-xs tracking-widest text-gv-accent hover:text-purple-300 transition"
                        title="Move down"
                      >
                        ↓
                      </button>

                      <button
                        onClick={() => removeSong(s.id)}
                        className="text-xs tracking-widest text-gv-accent hover:text-red-300 transition"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>

                  {noteOpen ? (
                    <div className="px-4 pb-4">
                      <textarea
                        value={noteDraftById[s.id] ?? (s.note ?? "")}
                        onChange={(e) =>
                          setNoteDraftById((prev) => ({
                            ...prev,
                            [s.id]: e.target.value,
                          }))
                        }
                        maxLength={SONG_NOTE_LIMIT}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                        rows={3}
                        placeholder="What does this song mean to you?"
                      />

                      <CharacterCounter
                        value={noteDraftById[s.id] ?? (s.note ?? "")}
                        max={SONG_NOTE_LIMIT}
                      />

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          onClick={() => saveSingleNote(s.id)}
                          disabled={savingNoteId === s.id}
                          className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-gv-accent hover:bg-purple-500/20 transition disabled:opacity-50"
                        >
                          {savingNoteId === s.id ? "SAVING…" : "SAVE NOTE"}
                        </button>

                        <button
                          onClick={() => clearSingleNote(s.id)}
                          disabled={savingNoteId === s.id}
                          className="text-xs tracking-widest text-gv-accent hover:text-red-300 transition disabled:opacity-50"
                        >
                          CLEAR
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <div className="mt-10 max-w-xl rounded-2xl border border-white/10 gv-accent p-5">
            <p className="text-xs tracking-widest text-gray-400">CREATE MIXLIST</p>
              <textarea
                value={mixMsg}
                onChange={(e) => setMixMsg(e.target.value)}
                maxLength={MIXLIST_MESSAGE_LIMIT}
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                rows={4}
                placeholder="Optional message/context for the person receiving this…"
              />

              <CharacterCounter value={mixMsg} max={MIXLIST_MESSAGE_LIMIT} />

              <textarea
                value={mixFinish}
                onChange={(e) => setMixFinish(e.target.value)}
                maxLength={FINISHING_NOTE_LIMIT}
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                rows={4}
                placeholder="Finishing note (only shown at the end)…"
              />

              <CharacterCounter value={mixFinish} max={FINISHING_NOTE_LIMIT} />

            <label className="mt-4 flex items-center gap-3 text-xs tracking-widest text-gray-400">
              <input
                type="checkbox"
                checked={mixReveal}
                onChange={(e) => setMixReveal(e.target.checked)}
                className="h-4 w-4 accent-purple-500"
              />
              REVEAL MODE (ONE AT A TIME)
            </label>

            <label className="mt-3 flex items-center gap-2 text-xs tracking-widest text-gray-400">
              <input
                type="checkbox"
                checked={includeSongNotes}
                onChange={(e) => setIncludeSongNotes(e.target.checked)}
                className="h-4 w-4 accent-purple-500"
              />
              INCLUDE SONG NOTES
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs tracking-widest text-gray-400">
              <input
                type="checkbox"
                checked={mixIsPublic}
                onChange={(e) => setMixIsPublic(e.target.checked)}
                className="h-4 w-4 accent-purple-500"
              />
              PUBLIC (ACCESS BY LINK)
            </label>
            <button
              onClick={createMixlist}
              disabled={creatingMix}
              className="mt-5 rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-gv-accent hover:bg-purple-500/20 transition disabled:opacity-50"
            >
              {creatingMix ? "PUBLISHING…" : "PUBLISH MIXLIST"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
