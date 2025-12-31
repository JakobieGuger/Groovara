"use client";

import { useEffect, useMemo, useState } from "react";

export type SpotifySearchResult = {
  id: string;
  title: string;
  artist: string;
  album: string;
  url: string;
  image: string | null;
};

export function SpotifySearch({
  onAdd,
}: {
  onAdd: (t: SpotifySearchResult) => Promise<void> | void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setErr(null);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });

        const json = (await res.json()) as { tracks?: SpotifySearchResult[]; error?: string };

        if (!res.ok || json.error) {
          setResults([]);
          setErr(json.error ?? `Search failed (${res.status})`);
          return;
        }

        setResults(json.tracks ?? []);
      } catch (e: unknown) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setErr("Search failed. Check API route / credentials.");
        }
      }
      finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [trimmed]);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
          placeholder="Search Spotify… (song, artist, album)"
        />
      </div>

      {loading && <p className="mt-3 text-sm text-gray-400">Searching…</p>}
      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <div className="mt-4 space-y-2">
        {results.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm text-gray-100">{r.title}</p>
                <p className="truncate text-xs text-gray-400">
                  {r.artist} • {r.album}
                </p>
              </div>
            </div>

            <button
              onClick={() => onAdd(r)}
              className="rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-[10px] tracking-widest text-purple-200 hover:bg-purple-500/20 transition flex-shrink-0"
            >
              ADD
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
