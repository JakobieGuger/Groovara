"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import InlineNotice from "../../lib/InlineNotice";


type Tracklist = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};


export default function TracklistsPage() {
  const [items, setItems] = useState<Tracklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);


  const load = async () => {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("tracklists")
      .select("id,title,description,created_at")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    else setItems((data ?? []) as Tracklist[]);

    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);


  const remove = async (id: string) => {
    if (!confirm("Delete this tracklist?")) return;

    const { error } = await supabase.from("tracklists").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  // Import Logic
  const runSpotifyImport = async () => {
    setImportErr(null);
    const url = importUrl.trim();
    if (!url) {
      setImportErr("Paste a Spotify playlist URL.");
      return;
    }

    setImportBusy(true);
    try {
      // 1) call API to resolve playlist + tracks
      const res = await fetch("/api/spotify/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Import failed.");

      const playlistName: string = json.playlist?.name ?? "Imported Playlist";
      const playlistDesc: string | null = json.playlist?.description ?? null;
      type ImportedTrack = {
        platform: "spotify";
        track_id: string;
        title: string;
        artist: string;
        album: string | null;
        url: string;
      };

      const tracks: ImportedTrack[] = Array.isArray(json.tracks)
        ? (json.tracks as ImportedTrack[])
        : [];


      if (tracks.length === 0) {
        throw new Error("No tracks found. Is the playlist public?");
      }

      // 2) auth (needed to insert)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userErr || !userId) throw new Error("Not authenticated.");

      // 3) create tracklist
      const { data: tl, error: tlErr } = await supabase
        .from("tracklists")
        .insert({
          user_id: userId, // you requested owner_id -> user_id
          title: playlistName,
          description: playlistDesc,
        })
        .select("id")
        .single();

      if (tlErr || !tl?.id) throw new Error(tlErr?.message ?? "Failed to create tracklist.");

      const tracklistId = tl.id as string;

      // 4) insert tracklist songs (bulk)
      const rows = tracks.map((t, idx) => ({
        tracklist_id: tracklistId,
        position: idx,
        platform: "spotify",
        track_id: t.track_id,
        title: t.title,
        artist: t.artist,
        album: t.album ?? null,
        url: t.url,
        note: null,
        version: null,
      }));

      const { error: insErr } = await supabase.from("tracklist_songs").insert(rows);
      if (insErr) throw new Error(insErr.message ?? "Failed to insert songs.");

      // 5) done → close modal and redirect into the imported list
      setImportOpen(false);
      setImportUrl("");
      window.location.href = `/tracklists/${tracklistId}`;
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      setImportErr(msg ?? "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <main className="p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-wide">Tracklists</h1>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setImportOpen(true)}
            className="text-xs tracking-widest text-purple-300 hover:text-purple-200 transition"
          >
            IMPORT PLAYLIST
          </button>

          <Link
            href="/tracklists/new"
            className="text-xs tracking-widest text-purple-300 hover:text-purple-200"
          >
            NEW
          </Link>
        </div>
      </div>

      {loading && <p className="mt-6 text-gray-400">Loading…</p>}

      {err && (
        <div className="mt-6">
          <InlineNotice
            kind="error"
            title="Couldn’t load your tracklists"
            message={err}
          />
        </div>
      )}

      {!loading && !err && items.length === 0 && (
        <div className="mt-6">
          <InlineNotice
            kind="info"
            title="No tracklists yet"
            message="Create your first tracklist to start building something worth sharing."
          />
        </div>
      )}


      <div className="mt-8 space-y-3">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <div>
              <Link
                href={`/tracklists/${t.id}`}
                className="text-lg font-light text-gray-100 hover:text-purple-200"
              >
                {t.title}
              </Link>
              {t.description && (
                <p className="mt-1 text-sm text-gray-400">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="text-xs tracking-widest text-gray-400 hover:text-red-300 transition"
            >
              DELETE
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={load}
        className="mt-10 text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
      >
        REFRESH
      </button>
      {importOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-gray-400">IMPORT PLAYLIST</p>
            <h3 className="mt-2 text-lg font-light text-gray-100">Spotify (for now)</h3>
            <p className="mt-2 text-sm text-gray-400">
              Paste a Spotify playlist URL. We’ll import it into a new Tracklist.
            </p>
          </div>

          <button
            onClick={() => {
              if (importBusy) return;
              setImportOpen(false);
              setImportErr(null);
            }}
            className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
          >
            CLOSE
          </button>
        </div>

        <div className="mt-5">
          <label className="block text-xs tracking-widest text-gray-400">PLAYLIST URL</label>
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
          />
        </div>

        {importErr ? (
          <div className="mt-4">
            <InlineNotice kind="error" title="Import failed" message={importErr} />
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={runSpotifyImport}
            disabled={importBusy}
            className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
          >
            {importBusy ? "IMPORTING…" : "IMPORT"}
          </button>

          <span className="text-xs tracking-widest text-gray-500">
            Public playlists work best right now.
          </span>
        </div>
      </div>
    </div>
  ) : null}
  </main>
  );
}
