"use client";

import { useEffect, useState} from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { SpotifySearch, type SpotifySearchResult } from "../../../lib/SpotifySearch";
import InlineNotice from "../../../lib/InlineNotice";




type Tracklist = {
  id: string;
  title: string;
  description: string | null;
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
  const [mTitle, setMTitle] = useState("");
  const [mArtist, setMArtist] = useState("");
  const [mUrl, setMUrl] = useState("");
  const [mAlbum, setMAlbum] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [mixMsg, setMixMsg] = useState("");
  const [mixReveal, setMixReveal] = useState(true);
  const [creatingMix, setCreatingMix] = useState(false);
  const [mixFinish, setMixFinish] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<string | null>(null);

  const DEV_MANUAL_ADD =
  process.env.NEXT_PUBLIC_DEV_MANUAL_ADD === "true";




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

  const [songs, setSongs] = useState<TrackSong[]>([]);

  const loadSongs = async () => {
  const { data, error } = await supabase
    .from("tracklist_songs")
    .select("id,tracklist_id,position,title,artist,album,url,note, platform, track_id")
    .eq("tracklist_id", id)
    .order("position", { ascending: true });

  if (error) {
    setPageError("Failed to load songs. Check your connection and try Refresh.");
    return;
  }
  setSongs((data ?? []) as TrackSong[]);
  };

useEffect(() => {
  const run = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tracklists")
      .select("id,title,description")
      .eq("id", id)
      .single();

    if (error) {
      setPageError("Failed to load songs. Check your connection and try Refresh.");
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
    } else {
      setSongs((songData ?? []) as TrackSong[]);
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

  // Update DB (one request per row; fine for beta)
  for (const u of updates) {
    const { error } = await supabase
      .from("tracklist_songs")
      .update({ position: u.position })
      .eq("id", u.id);

    if (error) {
      setPageError("Failed to load songs. Check your connection and try Refresh.");;
      return;
    }
  }

  // Update local state to match
  setSongs((prev) =>
    [...prev]
      .map((s) => ({ ...s, position: updates.find((u) => u.id === s.id)?.position ?? s.position }))
      .sort((a, b) => a.position - b.position)
  );
};


const addSong = async (t: SpotifySearchResult) => {
  const nextPos =
    songs.length === 0 ? 0 : Math.max(...songs.map((s) => s.position)) + 1;

  const { data, error } = await supabase
    .from("tracklist_songs")
    .insert({
      tracklist_id: id,
      position: nextPos,
      platform: "spotify",
      track_id: t.id,
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
    setPageError("Failed to load songs. Check your connection and try Refresh.");;
    return;
  }

  setSongs((prev) => [...prev, data as TrackSong]);
  const next = [...songs, data as TrackSong].sort((a,b)=>a.position-b.position);
  setSongs(next);
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

  if (error) return setPageError("Failed to snapshot songs into the mixlist. Please check your connection and try again.");
;

  setSongs((prev) => [...prev, data as TrackSong]);

  setMTitle("");
  setMArtist("");
  setMUrl("");
  setMAlbum("");
  const next = [...songs, data as TrackSong].sort((a,b)=>a.position-b.position);
  setSongs(next);
  await normalizePositions(next);
};

const removeSong = async (songId: string) => {
  if (!confirm("Remove this song from the tracklist?")) return;

  const { error } = await supabase.from("tracklist_songs").delete().eq("id", songId);

  if (error) return setPageError("Failed to load songs. Check your connection and try Refresh.");;

  setSongs((prev) => prev.filter((s) => s.id !== songId));
  const next = songs.filter((s) => s.id !== songId);
  setSongs(next);
  await normalizePositions(next)
};

const moveSong = async (songId: string, direction: "up" | "down") => {
  const idx = songs.findIndex((s) => s.id === songId);
  if (idx === -1) return;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= songs.length) return;

  const a = songs[idx];
  const b = songs[targetIdx];

  // Optimistic UI swap
  const swapped = [...songs];
  swapped[idx] = { ...b, position: a.position };
  swapped[targetIdx] = { ...a, position: b.position };
  swapped.sort((x, y) => x.position - y.position);
  setSongs(swapped);

  // Persist swap in DB (two updates)
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
    // Reload from DB to restore truth
    const { data: songData, error: songError } = await supabase
      .from("tracklist_songs")
      .select("id,tracklist_id,position,title,artist,album,url,note,platform,track_id")
      .eq("tracklist_id", id)
      .order("position", { ascending: true });

    if (!songError) setSongs((songData ?? []) as TrackSong[]);
  }
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

  // Try to derive a title from the source tracklist
  const { data: tl, error: tlErr } = await supabase
    .from("tracklists")
    .select("title")
    .eq("id", id)
    .single();
  
  const mixTitle =
    (!tlErr && tl?.title?.trim()) ? tl.title.trim() : `Mixlist • ${new Date().toLocaleDateString()}`;


  // 1) create mixlist row
  const { data: mix, error: mixErr } = await supabase
    .from("mixlists")
    .insert({
      owner_user_id: userId,
      title: mixTitle,
      source_tracklist_id: id,
      message: mixMsg.trim() || null,
      reveal_mode: mixReveal,
      is_public: true, // share-by-link for beta
      finishing_note: mixFinish.trim() || null,

    })
    .select("id,reveal_mode")
    .single();

  if (mixErr || !mix) {
    setCreatingMix(false);
    return alert(mixErr?.message ?? "Failed to create mixlist.");
  }


  const missing = songs.find(s => !s.platform || !s.track_id);
    if (missing) {
      setCreatingMix(false);
      return alert("One or more songs are missing platform/track_id. Reload and try again.");
    }

  // 2) snapshot songs
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
        <p className="mt-1 text-xs tracking-widest text-gray-500">
          TRACKLIST ID: {id}
        </p>
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
          message="Add songs from Spotify or manually to start shaping the tracklist."
        />
      </div>
    )}

    <div className="mt-10 max-w-xl space-y-4">
      <div>
        <label className="block text-xs tracking-widest text-gray-400">
          TITLE
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
        />
      </div>

      {pageError && (
        <InlineNotice
          kind="error"
          title="Something went wrong"
          message={pageError}
        />
      )}

      {pageInfo && <InlineNotice kind="info" message={pageInfo} />}

      <div>
        <label className="block text-xs tracking-widest text-gray-400">
          DESCRIPTION
        </label>
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

    <h2 className="mt-12 text-lg font-light tracking-wide">Songs</h2>

    <div className="mt-4">
      <SpotifySearch onAdd={addSong} />
    </div>

    {DEV_MANUAL_ADD && (
      <div className="mt-4 border border-yellow-500/30 bg-yellow-500/10 p-3 rounded-lg">
        <div className="text-xs text-yellow-300 tracking-widest mb-2">
          DEV ONLY
        </div>

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
        songs.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 hover:text-purple-200 transition"
            >
              <p className="truncate text-sm text-gray-100">
                {s.position + 1}. {s.title}
              </p>
              <p className="truncate text-xs text-gray-400">
                {s.artist}
                {s.album ? ` • ${s.album}` : ""}
              </p>
            </a>

            <div className="flex items-center gap-3 flex-shrink-0">
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
        ))
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
          />
          REVEAL MODE (ONE AT A TIME)
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
)};
