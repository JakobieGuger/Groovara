"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import InlineNotice from "../../../lib/InlineNotice";
import { supabase } from "../../../lib/supabaseClient";
import { convertTrackPlatform } from "@/lib/platformConversion";
import {
  createTheme,
  TrackScene,
  TrackTransition,
  TrackView,
  type UiTrack,
} from "../../../lib/mixlistPlayer";

type Mixlist = {
  id: string;
  title: string | null;
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
  revealed_count: number | null;
  clicked_json: boolean[] | null;
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [revealedSlots, setRevealedSlots] = useState(1);
  const [clicked, setClicked] = useState<boolean[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [userId, setUserId] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const [preferredPlatform, setPreferredPlatform] = useState<"spotify" | "youtube" | "apple">("youtube");

  const [autoplayToken, setAutoplayToken] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);


  type Platform = "spotify" | "youtube" | "apple";

  type ConvertedTrack = {
    title: string;
    artist: string;
    platform: Platform;
    track_id: string;
    url?: string;
  };

  const [convertedActiveTrack, setConvertedActiveTrack] = useState<ConvertedTrack | null>(null);
  const [convertingTrack, setConvertingTrack] = useState(false);

  const handleCopyLink = async () => {
    setExportMenuOpen(false);
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

  const handleExportSpotify = async () => {
    setExportMenuOpen(false);
    
    try {
      const res = await fetch("/api/spotify/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mixlistId,
        }),
      });
    
      const data = await res.json();
    
      if (!res.ok) {
        alert(data?.error ?? "Spotify export failed.");
        return;
      }
    
      if (data?.playlistUrl) {
        window.open(data.playlistUrl, "_blank", "noopener,noreferrer");
      } else {
        alert("Exported to Spotify.");
      }
    } catch (error) {
      console.error("Spotify export failed", error);
      alert("Spotify export failed.");
    }
  };

  

  // Optional user identity for per-user progress.
  // If anonymous, page should still render; progress just won’t persist.
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
        .select("id,title,message,finishing_note,reveal_mode,include_song_notes")
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

      setRevealedSlots(1);
      setClicked(new Array(list.length).fill(false));
      setSelectedIndex(0);

      setLoading(false);
    };

    void run();
  }, [mixlistId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("groovara_preferred_platform");
      if (saved === "spotify" || saved === "youtube" || saved === "apple") {
      setPreferredPlatform(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("groovara_preferred_platform", preferredPlatform);
    } catch {}
  }, [preferredPlatform]);

  // Hydrate persisted progress if logged in
  useEffect(() => {
    const hydrate = async () => {
      if (!mix) return;

      if (!mix.reveal_mode) {
        setProgressLoaded(true);
        return;
      }

      if (songs.length === 0) {
        setProgressLoaded(true);
        return;
      }

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

        for (let i = safeSlots; i < safeClicked.length; i++) safeClicked[i] = false;

        setRevealedSlots(safeSlots);
        setClicked(safeClicked);
        setSelectedIndex((prev) => Math.max(0, Math.min(prev, safeSlots - 1)));
      }

      setProgressLoaded(true);
    };

    void hydrate();
  }, [mix, songs.length, userId, mixlistId]);

  // Persist progress only for logged-in users
  useEffect(() => {
    if (!progressLoaded) return;
    if (!mix?.reveal_mode) return;
    if (!userId) return;
    if (songs.length === 0) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const safeSlots = Math.max(1, Math.min(revealedSlots, songs.length));

      const safeClicked = new Array(songs.length).fill(false);
      for (let i = 0; i < Math.min(clicked.length, songs.length); i++) {
        safeClicked[i] = clicked[i] === true;
      }
      for (let i = safeSlots; i < safeClicked.length; i++) safeClicked[i] = false;

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
  }, [progressLoaded, mix?.reveal_mode, userId, songs.length, revealedSlots, clicked, mixlistId]);

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

  const displayUiTrack = useMemo(() => {
    if (!activeUiTrack) return null;
    if (!convertedActiveTrack) return activeUiTrack;

    return {
      ...activeUiTrack,
      title: convertedActiveTrack.title || activeUiTrack.title,
      artist: convertedActiveTrack.artist || activeUiTrack.artist,
      url: convertedActiveTrack.url ?? activeUiTrack.url,
      platform: convertedActiveTrack.platform ?? activeUiTrack.platform,
      trackId: convertedActiveTrack.track_id ?? null,
    };
  }, [activeUiTrack, convertedActiveTrack]);
  

    const ambientTrack = useMemo<UiTrack>(() => {
      if (displayUiTrack) return displayUiTrack;
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
    }, [displayUiTrack, mixlistId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activeSong) {
        setConvertedActiveTrack(null);
        setConvertingTrack(false);
        return;
      }

      const sourcePlatform = getPlatform(activeSong.url ?? "");
      if (
        sourcePlatform !== "spotify" &&
        sourcePlatform !== "youtube" &&
        sourcePlatform !== "apple"
      ) {
        setConvertedActiveTrack(null);
        setConvertingTrack(false);
        return;
      }

      if (sourcePlatform === preferredPlatform) {
        setConvertedActiveTrack({
          title: activeSong.title,
          artist: activeSong.artist,
          platform: sourcePlatform,
          track_id: activeSong.id,
          url: activeSong.url,
        });
        setConvertingTrack(false);
        return;
      }

      setConvertingTrack(true);

      try {
        const converted = await convertTrackPlatform(
          {
            title: activeSong.title,
            artist: activeSong.artist,
            platform: sourcePlatform,
            track_id: activeSong.id,
            url: activeSong.url,
          },
          preferredPlatform
        );

        if (!cancelled) {
          setConvertedActiveTrack(
            converted
              ? {
                  title: converted.title ?? activeSong.title,
                  artist: converted.artist ?? activeSong.artist,
                  platform: converted.platform ?? sourcePlatform,
                  track_id: converted.track_id ?? activeSong.id,
                  url: converted.url ?? activeSong.url,
                }
              : {
                  title: activeSong.title,
                  artist: activeSong.artist,
                  platform: sourcePlatform,
                  track_id: activeSong.id,
                  url: activeSong.url,
                }
          );
        }
      } catch (error) {
        console.error("mixlist platform conversion failed", error);

        if (!cancelled) {
          setConvertedActiveTrack({
            title: activeSong.title,
            artist: activeSong.artist,
            platform: sourcePlatform,
            track_id: activeSong.id,
            url: activeSong.url,
          });
        }
      } finally {
        if (!cancelled) {
          setConvertingTrack(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeSong, preferredPlatform]);

  

  const activeIsHidden = useMemo(() => {
    if (!mix) return false;
    if (!mix.reveal_mode) return false;
    return clicked[safeSelectedIndex] !== true;
  }, [mix, clicked, safeSelectedIndex]);

  useEffect(() => {
  if (!hasInteracted) return;
  if (!activeSong) return;
  if (activeIsHidden) return;

  setAutoplayToken((v) => v + 1);
  }, [safeSelectedIndex, displayUiTrack?.url, hasInteracted, activeSong, activeIsHidden]);

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

  const songNoteCard = mix?.include_song_notes ? (
    <div className="gv_row rounded-2xl border border-border p-5">
      <p className="text-xs tracking-[0.22em] text-muted-foreground">
        {noteRangeLabel}
      </p>

      {!activeSong ? (
        <p className="mt-3 text-sm text-muted-foreground">No song selected.</p>
      ) : activeIsHidden ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Reveal this song to see the note.
        </p>
      ) : (activeSong.note ?? "").trim().length > 0 ? (
        <p className="gv_accent mt-3 whitespace-pre-wrap text-sm">
          {activeSong.note}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No note for this song.
        </p>
      )}
    </div>
  ) : null;

  const messageCard = mix?.message ? (
    <div className="gv_row rounded-2xl p-5">
      <p className="text-xs tracking-widest text-muted-foreground">MESSAGE</p>
      <p className="gv_accent mt-3 whitespace-pre-wrap text-sm">
        {mix.message}
      </p>
    </div>
  ) : null;

  const platformSelectorCard = (
  <div className="gv_row rounded-2xl p-4">
    <label className="mb-2 block text-xs tracking-[0.22em] text-muted-foreground">
      LISTEN ON
    </label>

    <select
      value={preferredPlatform}
      onChange={(e) => setPreferredPlatform(e.target.value as Platform)}
      className="w-full appearance-none rounded-full border border-purple-500/40 bg-black/70 px-4 py-3 text-sm text-white outline-none transition hover:bg-black/80"
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

    {convertingTrack ? (
      <p className="mt-2 text-xs tracking-widest text-muted-foreground">
        Converting current track...
      </p>
    ) : null}
  </div>
);

const copyLinkCard = (
  <div className="gv_row rounded-2xl p-4">
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={handleCopyLink}
        className="gv_row gv_accent rounded-full px-4 py-2 text-[11px] tracking-[0.22em] transition"
      >
        COPY LINK
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setExportMenuOpen((open) => !open)}
          className="gv_row gv_accent w-full rounded-full px-4 py-2 text-[11px] tracking-[0.22em] transition"
        >
          EXPORT
        </button>

        {exportMenuOpen ? (
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-background/95 p-2 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={handleExportSpotify}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-purple-500/10"
            >
              <span>Spotify</span>
              <span className="text-xs text-purple-300">Export</span>
            </button>

            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-muted-foreground opacity-70"
            >
              <span>Apple Music</span>
              <span className="text-[10px] uppercase tracking-widest">
                Coming soon
              </span>
            </button>

            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-muted-foreground opacity-70"
            >
              <span>YouTube</span>
              <span className="text-[10px] uppercase tracking-widest">
                Coming soon
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>

    {copyStatus ? (
      <p className="mt-2 text-center text-xs tracking-widest text-muted-foreground">
        {copyStatus}
      </p>
    ) : null}
  </div>
);

const revealOrBackButton =
  mix?.reveal_mode && revealedSlots < songs.length && clicked[0] === true ? (
    <button
      onClick={handleRevealNext}
      disabled={!canRevealNext}
      className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-gv_accent transition hover:bg-purple-500/20 disabled:opacity-50"
    >
      REVEAL NEXT
    </button>
  ) : (
    <Link
      href="/mixlists"
      className="block w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-center text-xs tracking-widest text-gv_accent transition hover:bg-purple-500/20"
    >
      BACK TO MIXLISTS
    </Link>
  );

  if (loading) {
    return (
      <main className="p-10 text-foreground">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="p-6 text-foreground">
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
      <main className="p-6 text-foreground">
        <InlineNotice kind="error" title="Something went wrong" message={err} />
      </main>
    );
  }

  if (!mix) {
    return (
      <main className="p-6 text-foreground">
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
      className="relative min-h-screen overflow-hidden p-6 text-foreground sm:p-10"
      style={{
        background:
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark")
            ? ambientTrack != null
              ? `radial-gradient(circle at 20% 12%, ${ambientTrack.theme.accentColor}22, transparent 45%),
                 radial-gradient(circle at 80% 84%, ${ambientTrack.theme.glowColor}26, transparent 40%),
                 #050507`
              : "#050507"
            : undefined,
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center xl:text-left">
            <p className="text-xs tracking-[0.25em] text-muted-foreground">
              MIXLIST
            </p>
            <h1 className="gv_accent mt-2 text-3xl font-semibold tracking-wide">
              {mix.title || "Untitled Mixlist"}
            </h1>
          </div>

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
            {displayUiTrack ? (
              <TrackTransition
                transitionKey={`${safeSelectedIndex}:${
                  displayUiTrack?.platform ?? "none"
                }:${displayUiTrack?.url ?? "no-url"}`}
              >
                <TrackView
                  key={`${displayUiTrack.id}:${displayUiTrack.platform}:${
                    displayUiTrack.url ?? "no-url"
                  }:${autoplayToken}`}
                  track={displayUiTrack}
                  isActive={true}
                  isRevealed={!activeIsHidden}
                  showNotes={false}
                  notes={activeSong?.note}
                  autoplay={hasInteracted}
                  onPlay={() => {
                    setHasInteracted(true);
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
                    setHasInteracted(true);
                    setSelectedIndex(safeSelectedIndex);

                    if (mix.reveal_mode) {
                      setClicked((prev) => {
                        const next = [...prev];
                        next[safeSelectedIndex] = true;
                        return next;
                      });
                    }
                  }}
                  disabledReason={
                    activeIsHidden ? "Reveal this song to play it." : null
                  }
                  onPrev={() => {
                    setHasInteracted(true);
                    setSelectedIndex(Math.max(0, safeSelectedIndex - 1));
                  }}
                  onNext={() => {
                    setHasInteracted(true);
                    setSelectedIndex(
                      Math.min(visibleSongs.length - 1, safeSelectedIndex + 1)
                    );
                  }}
                  disabledPrev={safeSelectedIndex === 0}
                  disabledNext={safeSelectedIndex >= visibleSongs.length - 1}
                />
              </TrackTransition>
            ) : (
              <div className="gv_row rounded-3xl p-6 text-sm text-muted-foreground">
                Select a song to begin.
              </div>
            )}

            <div className="space-y-4 xl:hidden">
              {messageCard}
              {platformSelectorCard}
              {copyLinkCard}
              {songNoteCard}
              {revealOrBackButton}
            </div>

            <div className="gv_row space-y-2 rounded-3xl p-3">
              {visibleSongs.map((s, idx) => {
                const isHidden = mix.reveal_mode && clicked[idx] !== true;

                if (isHidden) {
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setHasInteracted(true);
                        setSelectedIndex(idx);
                        setClicked((prev) => {
                          const next = [...prev];
                          next[idx] = true;
                          return next;
                        });
                      }}
                      className="gv_row block w-full rounded-2xl px-4 py-4 text-left transition"
                    >
                      <p className="gv_accent text-sm">Song {idx + 1}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click to reveal
                      </p>
                    </button>
                  );
                }

                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setHasInteracted(true);
                      setSelectedIndex(idx);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setHasInteracted(true);
                        setSelectedIndex(idx);
                      }
                    }}
                    className={`gv_row rounded-2xl border px-4 py-3 transition ${
                      idx === safeSelectedIndex
                        ? "ring-1 ring-[color:var(--ring)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="gv_accent text-sm">
                          {idx + 1}. {s.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.artist}
                          {s.album ? ` - ${s.album}` : ""}
                        </p>
                      </div>

                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="gv_row gv_accent rounded-lg px-2 py-1 text-[10px] tracking-[0.2em] transition"
                      >
                        OPEN
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {showFinishingNote ? (
              <div className="gv_row rounded-2xl p-5">
                <p className="text-xs tracking-widest text-muted-foreground">
                  FINISHING NOTE
                </p>
                <p className="gv_accent mt-3 whitespace-pre-wrap text-sm">
                  {mix.finishing_note}
                </p>
              </div>
            ) : null}
          </div>
          <div className="hidden xl:block">
            <div className="sticky top-8 space-y-4">
              {messageCard}
              {platformSelectorCard}
              {copyLinkCard}
              {songNoteCard}
              {revealOrBackButton}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}