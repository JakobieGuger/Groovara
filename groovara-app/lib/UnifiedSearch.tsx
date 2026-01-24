"use client";

import { useEffect, useMemo, useState } from "react";

export type PlatformKey = "spotify" | "apple" | "youtube";

export type UnifiedSearchResult = {
  platform: PlatformKey;
  track_id: string;

  title: string;
  artist: string;
  album: string | null;

  url: string;
  image: string | null;
};

export default function UnifiedSearch({
  onAdd,
}: {
  onAdd: (t: UnifiedSearchResult) => Promise<void> | void;
}) {
  const [platform, setPlatform] = useState<PlatformKey>("spotify");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    // Clear results when query is blank
    if (!trimmed) {
      setResults([]);
      setErr(null);
      setLoading(false);
      return;
    }

    const endpoint =
      platform === "spotify"
        ? "/api/spotify/search"
        : platform === "youtube"
        ? "/api/youtube/search"
        : platform === "apple"
        ? "/api/apple/search"
        : null;

    if (!endpoint) {
      setResults([]);
      setLoading(false);
      setErr("Coming soon: this platform search isn’t enabled yet.");
      return;
    }


    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`${endpoint}?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        type SearchApiResponse = {
          tracks?: Array<{
            id: string;
            title: string;
            artist: string;
            album?: string | null;
            url: string;
            image?: string | null;
          }>;
          error?: string;
        };


        const json = (await res.json()) as SearchApiResponse;


        if (!res.ok || json.error) {
          setResults([]);
          setErr(json.error ?? `Search failed (${res.status})`);
          return;
        }

        const normalized: UnifiedSearchResult[] = (json.tracks ?? []).map((r) => ({
          platform,
          track_id: r.id,
          title: r.title,
          artist: r.artist,
          album: r.album ?? null,
          url: r.url,
          image: r.image ?? null,
        }));

        setResults(normalized);
      } catch (e: unknown) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setErr("Search failed. Check API route / credentials.");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [trimmed, platform]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as PlatformKey)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-gray-100 outline-none focus:border-purple-500/40"
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


        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
          placeholder={
            platform === "spotify"
              ? "Search Spotify… (song, artist, album)"
              : platform === "apple"
              ? "Search Apple Music… (song, artist, album)"
              : "Search YouTube… (song, artist, album)"
          }
        />
      </div>
          
      {loading && <p className="mt-3 text-sm text-gray-400">Searching…</p>}
      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <div className="mt-4 space-y-2">
        {results.map((r) => (
          <div
            key={`${r.platform}:${r.track_id}`}
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
                  {r.artist}
                  {r.album ? ` • ${r.album}` : ""}
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
              try {
                await onAdd(r);
              } finally{
                setQ("");
                setResults([]);
                setErr(null);
              }
              }}
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
