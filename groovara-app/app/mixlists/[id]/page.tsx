"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";


type Mixlist = {
  id: string;
  message: string | null;
  finishing_note: string | null;
  reveal_mode: boolean;
};

type MixSong = {
  id: string;
  position: number;
  title: string;
  artist: string;
  album: string | null;
  url: string;
};

export default function MixlistPage() {
  const params = useParams<{ id: string }>();
  const mixlistId = params.id;

  const [mix, setMix] = useState<Mixlist | null>(null);
  const [songs, setSongs] = useState<MixSong[]>([]);
  const [loading, setLoading] = useState(true);

  // local reveal state (we can persist later)
  const [revealedSlots, setRevealedSlots] = useState(1); // how many song "cards" exist
  const [clicked, setClicked] = useState<boolean[]>([]);  // whether each slot has been clicked to reveal details

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const { data: mixData, error: mixErr } = await supabase
        .from("mixlists")
        .select("id,message,finishing_note,reveal_mode")
        .eq("id", mixlistId)
        .single();

      if (mixErr) {
        alert(mixErr.message);
        setLoading(false);
        return;
      }

      setMix(mixData as Mixlist);

      const { data: songData, error: songErr } = await supabase
        .from("mixlist_songs")
        .select("id,position,title,artist,album,url")
        .eq("mixlist_id", mixlistId)
        .order("position", { ascending: true });

      if (songErr) {
        alert(songErr.message);
        setLoading(false);
        return;
      }

      const list = (songData ?? []) as MixSong[];
      setSongs(list);
      setRevealedSlots(1);
      setClicked(new Array(list.length).fill(false));
      setLoading(false);
    };

    void run();
  }, [mixlistId]);

  if (loading) {
    return (
      <main className="p-10 text-gray-200">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  if (!mix) {
    return (
      <main className="p-10 text-gray-200">
        <p className="text-red-300">Mixlist not found.</p>
      </main>
    );
  }

const visibleCount = mix.reveal_mode ? Math.min(revealedSlots, songs.length) : songs.length;
const visibleSongs = songs.slice(0, visibleCount);
const canRevealNext =
  mix.reveal_mode &&
  revealedSlots < songs.length &&
  clicked[Math.max(0, revealedSlots - 1)] === true;

  const showFinishingNote =
  !!mix.finishing_note &&
  (!mix.reveal_mode ||
    (revealedSlots === songs.length && clicked[songs.length - 1] === true));



  return (
    <main className="p-10 text-gray-200">
      <h1 className="text-2xl font-light tracking-wide">Mixlist</h1>
      <div className="mt-2">
        <Link
            href="/"
            className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
        >
             ← HOME
        </Link>
    </div>

      {mix.message ? (
        <div className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{mix.message}</p>
        </div>
      ) : null}

      <div className="mt-8 space-y-2 max-w-2xl">
        {visibleSongs.map((s, idx) => {
          const isHidden = mix.reveal_mode && !clicked[idx];
        
          if (isHidden) {
            return (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
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
              className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:border-purple-500/30 transition"
            >
              <p className="text-sm text-gray-100">
                {idx + 1}. {s.title}
              </p>
              <p className="text-xs text-gray-400">
                {s.artist}{s.album ? ` • ${s.album}` : ""}
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
          <div className="mt-10 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs tracking-widest text-gray-400">FINISHING NOTE</p>
            <p className="mt-3 text-sm text-gray-200 whitespace-pre-wrap">
              {mix.finishing_note}
            </p>
          </div>
        ) : null}


    </main>
  );
}
