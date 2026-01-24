"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import UnifiedSearch, { UnifiedSearchResult } from "../../../lib/UnifiedSearch";
import InlineNotice from "../../../lib/InlineNotice";
import Image from "next/image";

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
  spotify: "/icons/spotify.png",
  youtube: "/icons/youtube.png",
  apple: "/icons/apple.png",
};

export default function TracklistDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [item, setItem] = useState<Tracklist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // DEV manual add
  const [mTitle, setMTitle] = useState("");
  const [mArtist, setMArtist] = useState("");
  const [mUrl, setMUrl] = useState("");
  const [mAlbum, setMAlbum] = useState("");
  const [addingManual, setAddingManual] = useState(false);

  // Mixlist creation
  const [mixMsg, setMixMsg] = useState("");
  const [mixReveal, setMixReveal] = useState(true);
  const [creatingMix, setCreatingMix] = useState(false);
  const [mixFinish, setMixFinish] = useState("");
  const [mixIsPublic, setMixIsPublic] = useState(true);

  // NEW: mixlist flag to show/hide notes on recipient side
  const [includeSongNotes, setIncludeSongNotes] = useState(true);

  const [pageError, setPageError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<string | null>(null);

  const DEV_MANUAL_ADD = process.env.NEXT_PUBLIC_DEV_MANUAL_ADD === "true";

  const [songs, setSongs] = useState<TrackSong[]>([]);

  // -------------------------
  // Notes: single + multi
  // -------------------------
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const [multiNoteMode, setMultiNoteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiNoteText, setMultiNoteText] = useState("");
  const [multiWorking, setMultiWorking] = useState(false);

  const selectedCount = selectedIds.size;

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
    const nums = selectedSorted.map((s) => s.position + 1); // 1-based display
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
      }

      setLoading(false);
    };

    void run();
  }, [id, router]);

  const save = async () => {
    if (!item) return;
    const trimmed = title.trim();
    if (!trimmed) return alert("Title is required.");

    setSaving(true);
    const { error } = await supabase
      .from("tracklists")
      .update({
        title: trimmed,
        description: description.trim() || null,
      })
      .eq("id", id);

    setSaving(false);

    if (error) return alert(error.message);

    setItem({ ...item, title: trimmed, description: description.trim() || null });
    alert("Saved.");
  };

  const remove = async () => {
    if (!confirm("Delete this tracklist?")) return;

    const { error } = await supabase.from("tracklists").delete().eq("id", id);
    if (error) return alert(error.message);

    router.replace("/tracklists");
  };

  const normalizePositions = async (ordered: TrackSong[]) => {
    const updates = ordered.map((s, i) => ({ id: s.id, position: i }));

    for (const u of updates) {
      const { error } = await supabase
        .from("tracklist_songs")
        .update({ position: u.position })
        .eq("id", u.id);

      if (error) {
        setPageError("Failed to save reorder. Check your connection and try Refresh.");
        return;
      }
    }

    setSongs((prev) =>
      [...prev]
        .map((s) => ({
          ...s,
          position: updates.find((u) => u.id === s.id)?.position ?? s.position,
        }))
        .sort((a, b) => a.position - b.position)
    );
  };

  const addSong = async (t: UnifiedSearchResult) => {
    setPageError(null);
    setPageInfo(null);

    const nextPos =
      songs.length === 0 ? 0 : Math.max(...songs.map((s) => s.position)) + 1;

    const { data, error } = await supabase
      .from("tracklist_songs")
      .insert({
        tracklist_id: id,
        position: nextPos,
        platform: t.platform,
        track_id: t.track_id,
        title: t.title,
        artist: t.artist,
        album: t.album || null,
        version: null,
        url: t.url,
        note: null,
      })
      .select("id,tracklist_id,position,title,artist,album,url,note,platform,track_id")
      .single();

    if (error) {
      setPageError("Failed to add song. Check your connection and try again.");
      return;
    }

    const inserted = data as TrackSong;
    const next = [...songs, inserted].sort((a, b) => a.position - b.position);
    setSongs(next);
    seedNoteDrafts(next);

    await normalizePositions(next);
  };

  const addManual = async () => {
    const title = mTitle.trim();
    const artist = mArtist.trim();
    const url = mUrl.trim();
    const album = mAlbum.trim();

    if (!title) return alert("Title is required.");
    if (!artist) return alert("Artist is required.");
    if (!url) return alert("A link is required (Spotify/YouTube/etc).");

    setAddingManual(true);

    const nextPos =
      songs.length === 0 ? 0 : Math.max(...songs.map((s) => s.position)) + 1;

    const { data, error } = await supabase
      .from("tracklist_songs")
      .insert({
        tracklist_id: id,
        position: nextPos,
        platform: "manual",
        track_id: `manual_${crypto.randomUUID()}`,
        title,
        artist,
        album: album || null,
        version: null,
        url,
        note: null,
      })
      .select("id,tracklist_id,position,title,artist,album,url,note,platform,track_id")
      .single();

    setAddingManual(false);

    if (error) {
      setPageError("Failed to add manual song. Check your connection and try again.");
      return;
    }

    const inserted = data as TrackSong;
    const next = [...songs, inserted].sort((a, b) => a.position - b.position);
    setSongs(next);
    seedNoteDrafts(next);

    setMTitle("");
    setMArtist("");
    setMUrl("");
    setMAlbum("");

    await normalizePositions(next);
  };

  const removeSong = async (songId: string) => {
    if (!confirm("Remove this song from the tracklist?")) return;

    const { error } = await supabase.from("tracklist_songs").delete().eq("id", songId);

    if (error) {
      setPageError("Failed to remove song. Check your connection and try Refresh.");
      return;
    }

    const next = songs.filter((s) => s.id !== songId);
    setSongs(next);
    seedNoteDrafts(next);

    setSelectedIds((prev) => {
      if (!prev.has(songId)) return prev;
      const n = new Set(prev);
      n.delete(songId);
      return n;
    });

    if (expandedNoteId === songId) setExpandedNoteId(null);

    await normalizePositions(next);
  };

  const moveSong = async (songId: string, direction: "up" | "down") => {
    const idx = songs.findIndex((s) => s.id === songId);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= songs.length) return;

    const a = songs[idx];
    const b = songs[targetIdx];

    const swapped = [...songs];
    swapped[idx] = { ...b, position: a.position };
    swapped[targetIdx] = { ...a, position: b.position };
    swapped.sort((x, y) => x.position - y.position);
    setSongs(swapped);

    const { error: e1 } = await supabase
      .from("tracklist_songs")
      .update({ position: b.position })
      .eq("id", a.id);

    const { error: e2 } = await supabase
      .from("tracklist_songs")
      .update({ position: a.position })
      .eq("id", b.id);

    if (e1 || e2) {
      alert((e1 ?? e2)?.message ?? "Failed to reorder.");
      await loadSongs();
      return;
    }

    seedNoteDrafts(swapped);
  };

  // -------------------------
  // Single note actions
  // -------------------------
  const saveSingleNote = async (songId: string) => {
    const text = (noteDraftById[songId] ?? "").trim();
    setSavingNoteId(songId);
    setPageError(null);
    setPageInfo(null);

    const { error } = await supabase
      .from("tracklist_songs")
      .update({ note: text.length ? text : null })
      .eq("id", songId);

    setSavingNoteId(null);

    if (error) {
      setPageError("Failed to save note. Try again.");
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

    const { error } = await supabase
      .from("tracklist_songs")
      .update({ note: null })
      .eq("id", songId);

    setSavingNoteId(null);

    if (error) {
      setPageError("Failed to clear note. Try again.");
      return;
    }

    setSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, note: null } : s)));
    setPageInfo("Note cleared.");
    window.setTimeout(() => setPageInfo(null), 1200);
  };

  // -------------------------
  // Multi-note actions
  // -------------------------
  const applyNoteToSelected = async () => {
    if (!multiNoteMode || selectedIds.size === 0) return;
    const text = multiNoteText.trim();

    setMultiWorking(true);
    setPageError(null);
    setPageInfo(null);

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("tracklist_songs")
      .update({ note: text.length ? text : null })
      .in("id", ids);

    setMultiWorking(false);

    if (error) {
      setPageError("Failed to apply note to selected songs.");
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
    const { error } = await supabase
      .from("tracklist_songs")
      .update({ note: null })
      .in("id", ids);

    setMultiWorking(false);

    if (error) {
      setPageError("Failed to clear note for selected songs.");
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
    if (songs.length === 0) return alert("Add at least one song first.");

    setCreatingMix(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (userErr || !userId) {
      setCreatingMix(false);
      return alert("Not authenticated.");
    }

    const { data: tl, error: tlErr } = await supabase
      .from("tracklists")
      .select("title")
      .eq("id", id)
      .single();

    const mixTitle =
      !tlErr && tl?.title?.trim()
        ? tl.title.trim()
        : `Mixlist • ${new Date().toLocaleDateString()}`;

    const { data: mix, error: mixErr } = await supabase
      .from("mixlists")
      .insert({
        owner_user_id: userId,
        title: mixTitle,
        source_tracklist_id: id,
        message: mixMsg.trim() || null,
        reveal_mode: mixReveal,
        is_public: mixIsPublic,
        finishing_note: mixFinish.trim() || null,

        // NEW: controls whether recipient sees notes UI
        include_song_notes: includeSongNotes,
      })
      .select("id,reveal_mode")
      .single();

    if (mixErr || !mix) {
      setCreatingMix(false);
      return alert(mixErr?.message ?? "Failed to create mixlist.");
    }

    const missing = songs.find((s) => !s.platform || !s.track_id);
    if (missing) {
      setCreatingMix(false);
      return alert("One or more songs are missing platform/track_id. Reload and try again.");
    }

    const payload = songs
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s, i) => ({
        mixlist_id: mix.id,
        position: i + 1,
        platform: s.platform,
        track_id: s.track_id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        version: null,
        url: s.url,
        note: s.note,
      }));

    const { error: snapErr } = await supabase.from("mixlist_songs").insert(payload);

    setCreatingMix(false);

    if (snapErr) {
      setPageError("Failed to snapshot songs into the mixlist. Please try again.");
      return;
    }

    router.push(`/mixlists/${mix.id}`);
  };

  if (loading) {
    return (
      <main className="p-10">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{item?.title}</h1>
          <p className="mt-1 text-xs tracking-widest text-gray-500">TRACKLIST ID: {id}</p>
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
          <label className="block text-xs tracking-widest text-gray-400">TITLE</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
          />
        </div>

        {pageError && (
          <InlineNotice kind="error" title="Something went wrong" message={pageError} />
        )}

        {pageInfo && <InlineNotice kind="info" message={pageInfo} />}

        <div>
          <label className="block text-xs tracking-widest text-gray-400">DESCRIPTION</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            rows={5}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
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
          className="rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-2 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition"
        >
          {multiNoteMode ? "EXIT MULTI-NOTE" : "MULTI-NOTE MODE"}
        </button>
      </div>

      {multiNoteMode ? (
        <div className="mt-4 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-widest text-gray-400">MULTI-NOTE</p>
              <p className="mt-2 text-sm text-gray-200">
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
            className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            rows={4}
            placeholder="Write a note to apply to the selected songs…"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={applyNoteToSelected}
              disabled={multiWorking || selectedCount === 0}
              className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
            >
              {multiWorking ? "APPLYING…" : "APPLY NOTE"}
            </button>

            <button
              onClick={clearNoteForSelected}
              disabled={multiWorking || selectedCount === 0}
              className="rounded-full border border-red-500/30 bg-red-500/10 px-6 py-3 text-xs tracking-widest text-red-200 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              {multiWorking ? "WORKING…" : "CLEAR NOTES"}
            </button>

            <span className="text-xs tracking-widest text-gray-500">
              Tip: use checkboxes on each row.
            </span>
          </div>
        </div>
      ) : null}

      {/* Unified Search (wrapped instead of disabled prop) */}
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
              <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 hover:text-purple-200 transition"
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
                          width={16}
                          height={16}
                          className="opacity-80 flex-shrink-0"
                        />
                      ) : null}

                      <p className="truncate text-sm text-gray-100">
                        {s.position + 1}. {s.title}
                      </p>
                    </div>

                    <p className="truncate text-xs text-gray-400">
                      {s.artist}
                      {s.album ? ` • ${s.album}` : ""}
                    </p>
                  </a>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => setExpandedNoteId(noteOpen ? null : s.id)}
                      className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
                      title="Song note"
                    >
                      NOTE {noteOpen ? "▴" : "▾"}{hasNote ? " •" : ""}
                    </button>

                    <button
                      onClick={() => moveSong(s.id, "up")}
                      className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
                      title="Move up"
                    >
                      ↑
                    </button>

                    <button
                      onClick={() => moveSong(s.id, "down")}
                      className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
                      title="Move down"
                    >
                      ↓
                    </button>

                    <button
                      onClick={() => removeSong(s.id)}
                      className="text-xs tracking-widest text-gray-400 hover:text-red-300 transition"
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
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
                      rows={3}
                      placeholder="What does this song mean to you?"
                    />

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => saveSingleNote(s.id)}
                        disabled={savingNoteId === s.id}
                        className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
                      >
                        {savingNoteId === s.id ? "SAVING…" : "SAVE NOTE"}
                      </button>

                      <button
                        onClick={() => clearSingleNote(s.id)}
                        disabled={savingNoteId === s.id}
                        className="text-xs tracking-widest text-gray-400 hover:text-red-300 transition disabled:opacity-50"
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

        <div className="mt-10 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs tracking-widest text-gray-400">CREATE MIXLIST</p>

          <textarea
            value={mixMsg}
            onChange={(e) => setMixMsg(e.target.value)}
            className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            rows={4}
            placeholder="Optional message/context for the person receiving this…"
          />

          <textarea
            value={mixFinish}
            onChange={(e) => setMixFinish(e.target.value)}
            className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            rows={4}
            placeholder="Finishing note (only shown at the end)…"
          />

          <label className="mt-4 flex items-center gap-3 text-xs tracking-widest text-gray-400">
            <input
              type="checkbox"
              checked={mixReveal}
              onChange={(e) => setMixReveal(e.target.checked)}
              className="h-4 w-4 accent-purple-500"
            />
            REVEAL MODE (ONE AT A TIME)
          </label>

          {/* NEW: toggle visibility of notes on the mixlist page */}
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
            className="mt-5 rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
          >
            {creatingMix ? "CREATING…" : "CREATE MIXLIST"}
          </button>
        </div>
      </div>
    </main>
  );
}
