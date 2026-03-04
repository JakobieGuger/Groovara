"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import InlineNotice from "../../../lib/InlineNotice";
import { supabase } from "../../../lib/supabaseClient";
import {
  createTheme,
  TrackScene,
  TrackTransition,
  TrackView,
  type UiTrack,
} from "../../../lib/mixlistPlayer";

type Mixlist = {
  id: string;
  message: string | null;
  finishing_note: string | null;
  reveal_mode: boolean;
  include_song_notes: boolean;
};

type MixSong = {
  id: string;
  position: number;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  note: string | null;
};

type MixlistProgressRow = {
  mixlist_id: string;
  user_id: string;
  revealed_count: number | null; // we'll store revealedSlots here
  clicked_json: boolean[] | null; // jsonb, should be boolean[]
};

function getPlatform(url: string): UiTrack["platform"] {
  const value = url.toLowerCase();
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("spotify.com")) return "spotify";
  if (value.includes("music.apple.com") || value.includes("itunes.apple.com")) return "apple";
  return "other";
}

function toUiTrack(song: MixSong, index: number): UiTrack {
  const theme = createTheme(`${song.id}:${song.title}:${song.artist}:${index}`, song.title, song.artist);

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

export default function MixlistPage() {
  const params = useParams<{ id: string }>();
  const mixlistId = params.id;

  const [mix, setMix] = useState<Mixlist | null>(null);
  const [songs, setSongs] = useState<MixSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // local reveal state (now persisted)
  const [revealedSlots, setRevealedSlots] = useState(1);
  const [clicked, setClicked] = useState<boolean[]>([]);

  // right-side note panel selection (index into visibleSongs)
  const [selectedIndex, setSelectedIndex] = useState(0);

  // persistence helpers
  const [userId, setUserId] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const handleCopyLink = async () => {
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
      window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("Couldn't copy. Copy from the address bar.");
      window.setTimeout(() => setCopyStatus(null), 2500);
    }
  };

  // Grab authed user (progress is per-user)
  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user?.id) setUserId(data.user.id);
      else setUserId(null);
    };
    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr(null);
      setNotFound(false);
      setProgressLoaded(false);

      const { data: mixData, error: mixErr } = await supabase
        .from("mixlists")
        .select("id,message,finishing_note,reveal_mode,include_song_notes")
        .eq("id", mixlistId)
        .maybeSingle();

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

      const { data: songData, error: songErr } = await supabase
        .from("mixlist_songs")
        .select("id,position,title,artist,album,url,note")
        .eq("mixlist_id", mixlistId)
        .order("position", { ascending: true });

      if (songErr) {
        setErr("Couldn't load songs for this mixlist. Please try again.");
        setLoading(false);
        return;
      }

      const list = (songData ?? []) as MixSong[];
      setSongs(list);

      // reset reveal state for this mixlist load (hydration may override)
      setRevealedSlots(1);
      setClicked(new Array(list.length).fill(false));
      setSelectedIndex(0);

      setLoading(false);
    };

    void run();
  }, [mixlistId]);

  // Hydrate persisted progress (after mix + songs + userId exist)
  useEffect(() => {
    const hydrate = async () => {
      // If no mix yet, no songs yet, wait
      if (!mix) return;

      // Not reveal mode: nothing to persist (but mark as loaded)
      if (!mix.reveal_mode) {
        setProgressLoaded(true);
        return;
      }

      // Need songs to size arrays
      if (songs.length === 0) {
        setProgressLoaded(true);
        return;
      }

      // If user isn't authed, we can't persist (RLS). Just run local.
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
        const safeSlots = Math.max(1, Math.min(storedSlots, songs.length));

        const safeClicked = new Array(songs.length).fill(false);
        if (Array.isArray(row.clicked_json)) {
          for (let i = 0; i < Math.min(row.clicked_json.length, songs.length); i++) {
            safeClicked[i] = row.clicked_json[i] === true;
          }
        }

        // Enforce reveal rules: anything beyond revealed slots cannot be clicked
        for (let i = safeSlots; i < safeClicked.length; i++) safeClicked[i] = false;

        setRevealedSlots(safeSlots);
        setClicked(safeClicked);
        setSelectedIndex((prev) => Math.max(0, Math.min(prev, safeSlots - 1)));
      }

      setProgressLoaded(true);
    };

    void hydrate();
  }, [mix, songs.length, userId, mixlistId]);

  // Persist progress (debounced) whenever reveal state changes
  useEffect(() => {
    if (!progressLoaded) return;
    if (!mix?.reveal_mode) return;
    if (!userId) return;
    if (songs.length === 0) return;

    // Clear any pending save
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const safeSlots = Math.max(1, Math.min(revealedSlots, songs.length));

      // Normalize clicked to songs length, and enforce reveal rule
      const safeClicked = new Array(songs.length).fill(false);
      for (let i = 0; i < Math.min(clicked.length, songs.length); i++) {
        safeClicked[i] = clicked[i] === true;
      }
      for (let i = safeSlots; i < safeClicked.length; i++) safeClicked[i] = false;

      // upsert requires unique(mixlist_id,user_id)
      await supabase
        .from("mixlist_progress")
        .upsert(
          {
            mixlist_id: mixlistId,
            user_id: userId,
            revealed_count: safeSlots,
            clicked_json: safeClicked,
          },
          { onConflict: "mixlist_id,user_id" }
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

  // Derived UI state (hooks-safe: always runs, even while loading/mix null)
  const visibleCount = useMemo(() => {
    if (!mix) return 0;
    return mix.reveal_mode ? Math.min(revealedSlots, songs.length) : songs.length;
  }, [mix, revealedSlots, songs.length]);

  const visibleSongs = useMemo(() => songs.slice(0, visibleCount), [songs, visibleCount]);

  const safeSelectedIndex = useMemo(() => {
    if (visibleSongs.length === 0) return 0;
    return Math.max(0, Math.min(selectedIndex, visibleSongs.length - 1));
  }, [selectedIndex, visibleSongs.length]);

  const activeSong = visibleSongs[safeSelectedIndex] ?? null;
  const uiVisibleTracks = useMemo(
    () => visibleSongs.map((song, idx) => toUiTrack(song, idx)),
    [visibleSongs]
  );
  const activeUiTrack = uiVisibleTracks[safeSelectedIndex] ?? null;
  const ambientTrack = useMemo<UiTrack>(() => {
    if (activeUiTrack) return activeUiTrack;
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
  }, [activeUiTrack, mixlistId]);

  const activeIsHidden = useMemo(() => {
    if (!mix) return false;
    if (!mix.reveal_mode) return false;
    return clicked[safeSelectedIndex] !== true;
  }, [mix, clicked, safeSelectedIndex]);

  const canRevealNext = useMemo(() => {
    if (!mix) return false;
    if (!mix.reveal_mode) return false;
    return revealedSlots < songs.length;
  }, [mix, revealedSlots, songs.length]);

  const handleRevealNext = () => {
    setRevealedSlots((r) => {
      const nextSlots = Math.min(r + 1, songs.length);
      const nextIndex = Math.max(0, nextSlots - 1);

      setSelectedIndex(nextIndex);
      setClicked((prev) => {
        const next = [...prev];
        if (nextIndex < next.length) next[nextIndex] = true;
        return next;
      });

      return nextSlots;
    });
  };

  const showFinishingNote = useMemo(() => {
    if (!mix?.finishing_note) return false;
    if (!mix.reveal_mode) return true;
    if (songs.length === 0) return false;
    return revealedSlots === songs.length && clicked[songs.length - 1] === true;
  }, [mix, revealedSlots, songs.length, clicked]);

  const noteRangeLabel = useMemo(() => {
    if (!activeSong) return "SONG NOTE";

    const noteText = (activeSong.note ?? "").trim();
    const n = safeSelectedIndex + 1;

    if (!noteText) return `SONG #${n} NOTE`;

    const matches: number[] = [];
    for (let i = 0; i < songs.length; i++) {
      const t = (songs[i].note ?? "").trim();
      if (t && t === noteText) matches.push(i + 1);
    }

    if (matches.length <= 1) return `SONG #${n} NOTE`;

    const min = Math.min(...matches);
    const max = Math.max(...matches);
    return `SONGS #${min}-#${max} NOTE`;
  }, [activeSong, safeSelectedIndex, songs]);

  // ---- Rendering (returns AFTER all hooks) ----
  if (loading) {
    return (
      <main className="p-10 text-gray-200">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="p-6 text-white/90">
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
      <main className="p-6 text-white/90">
        <InlineNotice kind="error" title="Something went wrong" message={err} />
      </main>
    );
  }

  if (!mix) {
    return (
      <main className="p-6 text-white/90">
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
      className="relative min-h-screen overflow-hidden p-6 text-gray-200 sm:p-10"
      style={{
        background:
          ambientTrack != null
            ? `radial-gradient(circle at 20% 12%, ${ambientTrack.theme.accentColor}22, transparent 45%), radial-gradient(circle at 80% 84%, ${ambientTrack.theme.glowColor}26, transparent 40%), #050507`
            : "#050507",
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <TrackScene
          track={ambientTrack}
          intensity={ambientTrack.theme.intensity}
          showWords={Boolean(activeSong) && !activeIsHidden}
        />
      </div>

      <div className="relative z-10">
      <div className="flex max-w-3xl items-center justify-between">
        <h1 className="text-2xl font-light tracking-wide">Mixlist</h1>
        <button
          onClick={handleCopyLink}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] tracking-[0.22em] text-gray-300 transition hover:bg-white/10 xl:hidden"
        >
          COPY LINK
        </button>
      </div>

      <div className="mt-3 flex max-w-3xl items-center gap-4">
        <Link
          href="/"
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] tracking-[0.2em] text-gray-300 transition hover:bg-white/10"
        >
          HOME
        </Link>
        {copyStatus && (
          <span className="text-xs tracking-widest text-gray-500 xl:hidden">{copyStatus}</span>
        )}
      </div>

      {songs.length === 0 && (
        <div className="mt-6 max-w-3xl">
          <InlineNotice
            kind="info"
            title="This mixlist is empty"
            message="The creator didn't include any songs."
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {activeUiTrack ? (
            <TrackTransition activeIndex={safeSelectedIndex}>
              <TrackView
                track={activeUiTrack}
                isActive={true}
                isRevealed={!activeIsHidden}
                showNotes={false}
                notes={activeSong?.note}
                onPlay={() => {
                  setSelectedIndex(safeSelectedIndex);
                  if (mix.reveal_mode && clicked[safeSelectedIndex] !== true) {
                    setClicked((prev) => {
                      const next = [...prev];
                      next[safeSelectedIndex] = true;
                      return next;
                    });
                  }
                }}
                onReveal={() => {
                  setSelectedIndex(safeSelectedIndex);
                  if (mix.reveal_mode) {
                    setClicked((prev) => {
                      const next = [...prev];
                      next[safeSelectedIndex] = true;
                      return next;
                    });
                  }
                }}
                disabledReason={activeIsHidden ? "Reveal this song to play it." : null}
                onPrev={() => setSelectedIndex(Math.max(0, safeSelectedIndex - 1))}
                onNext={() =>
                  setSelectedIndex(Math.min(visibleSongs.length - 1, safeSelectedIndex + 1))
                }
                disabledPrev={safeSelectedIndex === 0}
                disabledNext={safeSelectedIndex >= visibleSongs.length - 1}
              />
            </TrackTransition>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/65">
              Select a song to begin.
            </div>
          )}

          <div className="space-y-2 rounded-3xl border border-white/10 bg-white/5 p-3">
            {visibleSongs.map((s, idx) => {
              const isHidden = mix.reveal_mode && clicked[idx] !== true;

              if (isHidden) {
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(idx);
                      setClicked((prev) => {
                        const next = [...prev];
                        next[idx] = true;
                        return next;
                      });
                    }}
                    className="block w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left transition hover:border-white/20"
                  >
                    <p className="text-sm text-gray-100">Song {idx + 1}</p>
                    <p className="mt-1 text-xs text-gray-400">Click to reveal</p>
                  </button>
                );
              }

              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIndex(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedIndex(idx);
                    }
                  }}
                  className={`rounded-2xl border bg-black/25 px-4 py-3 transition ${
                    idx === safeSelectedIndex
                      ? "border-white/35"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-100">
                        {idx + 1}. {s.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.artist}
                        {s.album ? ` - ${s.album}` : ""}
                      </p>
                    </div>

                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[10px] tracking-[0.2em] text-gray-300 transition hover:bg-black/40"
                    >
                      OPEN
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {mix.reveal_mode && revealedSlots < songs.length && clicked[0] === true ? (
            <button
              onClick={handleRevealNext}
              disabled={!canRevealNext}
              className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-40 disabled:hover:bg-purple-500/10"
            >
              REVEAL NEXT
            </button>
          ) : null}

          {showFinishingNote ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs tracking-widest text-gray-400">FINISHING NOTE</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{mix.finishing_note}</p>
            </div>
          ) : null}
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-8 space-y-4">
            {mix.message ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs tracking-widest text-gray-400">MESSAGE</p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{mix.message}</p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <button
                onClick={handleCopyLink}
                className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] tracking-[0.22em] text-gray-300 transition hover:bg-white/10"
              >
                COPY LINK
              </button>
              {copyStatus ? (
                <p className="mt-2 text-center text-xs tracking-widest text-gray-500">{copyStatus}</p>
              ) : null}
            </div>

            {mix.include_song_notes ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs tracking-widest text-gray-400">{noteRangeLabel}</p>

                {!activeSong ? (
                  <p className="mt-3 text-sm text-gray-400">No song selected.</p>
                ) : activeIsHidden ? (
                  <p className="mt-3 text-sm text-gray-400">Reveal this song to see the note.</p>
                ) : (activeSong.note ?? "").trim().length > 0 ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{activeSong.note}</p>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">No note for this song.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
