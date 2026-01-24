"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";
import InlineNotice from "../../../lib/InlineNotice";

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
      setCopyStatus("Couldn’t copy. Copy from the address bar.");
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
        setErr("Couldn’t load this mixlist. Please try again.");
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
        setErr("Couldn’t load songs for this mixlist. Please try again.");
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

  const activeIsHidden = useMemo(() => {
    if (!mix) return false;
    if (!mix.reveal_mode) return false;
    return clicked[safeSelectedIndex] !== true;
  }, [mix, clicked, safeSelectedIndex]);

  const canRevealNext = useMemo(() => {
    if (!mix) return false;
    if (!mix.reveal_mode) return false;
    if (revealedSlots >= songs.length) return false;
    return clicked[Math.max(0, revealedSlots - 1)] === true;
  }, [mix, revealedSlots, songs.length, clicked]);

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
    return `SONGS #${min}–#${max} NOTE`;
  }, [activeSong, safeSelectedIndex, songs]);

  // ---- Rendering (returns AFTER all hooks) ----
  if (loading) {
    return (
      <main className="p-10 text-gray-200">
        <p className="text-gray-400">Loading…</p>
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
    <main className="p-10 text-gray-200">
      <div className="flex items-center justify-between">
        <div className="max-w-2xl flex items-center justify-between w-full">
          <h1 className="text-2xl font-light tracking-wide">Mixlist</h1>
          <button
            onClick={handleCopyLink}
            className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
          >
            COPY LINK
          </button>
        </div>
      </div>

      <div className="mt-2 max-w-2xl flex items-center gap-4">
        <Link href="/" className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition">
          ← HOME
        </Link>
        {copyStatus && <span className="text-xs tracking-widest text-gray-500">{copyStatus}</span>}
      </div>

      {songs.length === 0 && (
        <InlineNotice kind="info" title="This mixlist is empty" message="The creator didn’t include any songs." />
      )}

      {/* Two-column layout */}
      <div className="mt-8 flex gap-8">
        {/* LEFT */}
        <div className="w-full max-w-2xl">
          <div className="space-y-2">
            {visibleSongs.map((s, idx) => {
              const isHidden = mix.reveal_mode && clicked[idx] !== true;

              if (isHidden) {
                return (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onFocus={() => setSelectedIndex(idx)}
                    onClick={() => {
                      setSelectedIndex(idx);
                      setClicked((prev) => {
                        const next = [...prev];
                        next[idx] = true;
                        return next;
                      });
                    }}
                    className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 hover:border-purple-500/30 transition"
                  >
                    <p className="text-sm text-gray-100">Song {idx + 1}</p>
                    <p className="mt-1 text-xs text-gray-400">Click to reveal</p>
                  </a>
                );
              }

              return (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onFocus={() => setSelectedIndex(idx)}
                  className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:border-purple-500/30 transition"
                >
                  <p className="text-sm text-gray-100">
                    {idx + 1}. {s.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {s.artist}
                    {s.album ? ` • ${s.album}` : ""}
                  </p>
                </a>
              );
            })}
          </div>

          {mix.reveal_mode && revealedSlots < songs.length ? (
            <button
              onClick={() => setRevealedSlots((r) => Math.min(r + 1, songs.length))}
              disabled={!canRevealNext}
              className="mt-8 rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-40 disabled:hover:bg-purple-500/10"
            >
              REVEAL NEXT
            </button>
          ) : null}

          {showFinishingNote ? (
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs tracking-widest text-gray-400">FINISHING NOTE</p>
              <p className="mt-3 text-sm text-gray-200 whitespace-pre-wrap">{mix.finishing_note}</p>
            </div>
          ) : null}
        </div>

        {/* RIGHT */}
        {mix.include_song_notes ? (
          <div className="hidden lg:block w-[22rem] flex-shrink-0">
            <div className="sticky top-10 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs tracking-widest text-gray-400">{noteRangeLabel}</p>
        
              {!activeSong ? (
                <p className="mt-3 text-sm text-gray-400">No song selected.</p>
              ) : activeIsHidden ? (
                <p className="mt-3 text-sm text-gray-400">Reveal this song to see the note.</p>
              ) : (activeSong.note ?? "").trim().length > 0 ? (
                <p className="mt-3 text-sm text-gray-200 whitespace-pre-wrap">{activeSong.note}</p>
              ) : (
                <p className="mt-3 text-sm text-gray-400">No note for this song.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
