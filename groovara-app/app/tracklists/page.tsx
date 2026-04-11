"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import InlineNotice from "../../lib/InlineNotice";
import {
  deleteTracklistAction,
  importSpotifyTracklistAction,
} from "./actions";

type Tracklist = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

const accentLink =
  "text-xs tracking-widest gv-accent hover:text-purple-900 dark:gv-accent dark:hover:text-purple-200 transition";

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
      "Invalid request."
    );
  }

  return result.message ?? "Something went wrong.";
}

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

    const result = await deleteTracklistAction({ tracklistId: id });
    if (!result.ok) {
      setErr(getActionError(result));
      return;
    }

    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  const runSpotifyImport = async () => {
    setImportErr(null);
    const url = importUrl.trim();
    if (!url) {
      setImportErr("Paste a Spotify playlist URL.");
      return;
    }

    setImportBusy(true);
    try {
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

      const result = await importSpotifyTracklistAction({
        playlistName,
        playlistDescription: playlistDesc,
        tracks,
      });

      if (!result.ok) {
        throw new Error(getActionError(result));
      }

      setImportOpen(false);
      setImportUrl("");
      window.location.href = `/tracklists/${result.tracklistId}`;
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      setImportErr(msg ?? "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content p-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-wide">Tracklists</h1>

          <div className="flex items-center gap-6">
            <button onClick={() => setImportOpen(true)} className={accentLink}>
              IMPORT PLAYLIST
            </button>

            <Link href="/tracklists/new" className={accentLink}>
              NEW
            </Link>
          </div>
        </div>

        {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}

        {err && (
          <div className="mt-6">
            <InlineNotice kind="error" title="Couldn’t load your tracklists" message={err} />
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
              className="flex items-center justify-between rounded-2xl border border-border bg-card/80 px-5 py-4 shadow-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/tracklists/${t.id}`}
                  className="block truncate text-lg font-light text-foreground hover:text-purple-700 dark:hover:text-purple-200 transition"
                >
                  {t.title}
                </Link>
                {t.description && (
                  <p className="mt-1 text-sm text-muted-foreground truncate">{t.description}</p>
                )}
              </div>

              <button
                onClick={() => remove(t.id)}
                className="text-xs tracking-widest text-muted-foreground hover:text-red-600 dark:hover:text-red-300 transition"
              >
                DELETE
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={load}
          className="mt-10 text-xs tracking-widest text-muted-foreground hover:text-purple-700 dark:hover:text-purple-300 transition"
        >
          REFRESH
        </button>

        {importOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-widest text-muted-foreground">IMPORT PLAYLIST</p>
                  <h3 className="mt-2 text-lg font-light">Spotify (for now)</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Paste a Spotify playlist URL. We’ll import it into a new Tracklist.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (importBusy) return;
                    setImportOpen(false);
                    setImportErr(null);
                  }}
                  className="text-xs tracking-widest text-muted-foreground hover:text-purple-700 dark:hover:text-purple-300 transition"
                >
                  CLOSE
                </button>
              </div>

              <div className="mt-5">
                <label className="block text-xs tracking-widest text-muted-foreground">
                  PLAYLIST URL
                </label>
                <input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none focus:border-purple-500/40"
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
                  className="rounded-full border border-purple-500/40 gv-accent px-6 py-3 text-xs tracking-widest text-purple-800 hover:bg-purple-500/15 transition disabled:opacity-50 dark:text-purple-200"
                >
                  {importBusy ? "IMPORTING…" : "IMPORT"}
                </button>

                <span className="text-xs tracking-widest text-muted-foreground">
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
