"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PlatformKey = "spotify" | "apple" | "youtube";

export type UnifiedSearchResult = {
  platform: PlatformKey;
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  image: string | null;
  isrc: string | null;
};

type SearchApiResponse = {
  tracks?: Array<{
    id: string;
    title: string;
    artist: string;
    album?: string | null;
    url: string;
    image?: string | null;
    isrc?: string | null;
  }>;
  error?: string;
  code?: string;
  manualSearchUrl?: string;
};

export default function UnifiedSearch({
  onAdd,
}: {
  onAdd: (t: UnifiedSearchResult) => Promise<void> | void;
}) {
  const [platform, setPlatform] = useState<PlatformKey>("spotify");
  const [q, setQ] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manualSearchUrl, setManualSearchUrl] = useState<string | null>(null);

  const resultCacheRef = useRef(
    new Map<string, UnifiedSearchResult[]>(),
  );

  const trimmed = useMemo(() => q.trim(), [q]);

  const submitSearch = () => {
    if (!trimmed || loading) return;

    const cacheKey = `${platform}:${trimmed.toLowerCase()}`;
    const cached = resultCacheRef.current.get(cacheKey);

    if (cached) {
      setResults(cached);
      setErr(null);
      setManualSearchUrl(null);
      return;
    }

    setSubmittedQuery(trimmed);
    setSearchVersion((value) => value + 1);
  };

  useEffect(() => {
    if (!submittedQuery) return;

    const endpoint =
      platform === "spotify"
        ? "/api/spotify/search"
        : platform === "youtube"
          ? "/api/youtube/search"
          : "/api/apple/search";

    const cacheKey = `${platform}:${submittedQuery.toLowerCase()}`;
    const cached = resultCacheRef.current.get(cacheKey);

    if (cached) {
      setResults(cached);
      setErr(null);
      setManualSearchUrl(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setErr(null);
        setManualSearchUrl(null);

        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(submittedQuery)}`,
          { signal: controller.signal },
        );

        const json = (await res.json().catch(() => null)) as
          | SearchApiResponse
          | null;

        if (!res.ok || json?.error) {
          setResults([]);
          setErr(
            json?.error ??
              `Search failed (${res.status})`,
          );

          if (
            platform === "youtube" &&
            typeof json?.manualSearchUrl === "string"
          ) {
            setManualSearchUrl(json.manualSearchUrl);
          }

          return;
        }

        const normalized: UnifiedSearchResult[] =
          (json?.tracks ?? []).map((r) => ({
            platform,
            track_id: r.id,
            title: r.title,
            artist: r.artist,
            album: r.album ?? null,
            url: r.url,
            image: r.image ?? null,
            isrc: r.isrc ?? null,
          }));

        resultCacheRef.current.set(cacheKey, normalized);
        setResults(normalized);
      } catch (e: unknown) {
        if (
          !(e instanceof DOMException && e.name === "AbortError")
        ) {
          setResults([]);
          setErr("Search failed. Check your connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [platform, searchVersion, submittedQuery]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value as PlatformKey);
            setSubmittedQuery("");
            setResults([]);
            setErr(null);
            setManualSearchUrl(null);
          }}
          className="rounded-xl gv-row border border-white/10 bg-white/5 px-3 py-3 text-gv-accent outline-none focus:border-purple-500/40"
        >
          <option value="spotify" className="gv-row text-gv-accent">
            Spotify
          </option>
          <option value="youtube" className="gv-row text-gv-accent">
            YouTube
          </option>
          <option value="apple" className="gv-row text-gv-accent">
            Apple Music
          </option>
        </select>

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSubmittedQuery("");
            setResults([]);
            setErr(null);
            setManualSearchUrl(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitSearch();
            }
          }}
          className="w-full rounded-xl gv-row border border-white/10 bg-black/5 px-4 py-3 text-gv-accent outline-none focus:border-purple-500/40"
          placeholder={
            platform === "spotify"
              ? "Search Spotify… (song, artist, album)"
              : platform === "apple"
                ? "Search Apple Music… (song, artist, album)"
                : "Search YouTube… (song, artist, album)"
          }
        />

        <button
          type="button"
          onClick={submitSearch}
          disabled={!trimmed || loading}
          className="shrink-0 rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-3 text-[10px] tracking-widest text-gv-accent transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          SEARCH
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-gray-400">Searching…</p>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            {err}
          </p>

          {manualSearchUrl ? (
            <a
              href={manualSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs font-semibold tracking-widest text-gv-accent underline underline-offset-4"
            >
              SEARCH ON YOUTUBE
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {results.map((r) => (
          <div
            key={`${r.platform}:${r.track_id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm text-gv-accent">
                  {r.title}
                </p>
                <p className="truncate text-xs text-gv-accent">
                  {r.artist}
                  {r.album ? ` • ${r.album}` : ""}
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  await onAdd(r);
                } finally {
                  setQ("");
                  setSubmittedQuery("");
                  setResults([]);
                  setErr(null);
                  setManualSearchUrl(null);
                }
              }}
              className="flex-shrink-0 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-[10px] tracking-widest text-gv-accent transition hover:bg-purple-500/20"
            >
              ADD
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
