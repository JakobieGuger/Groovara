"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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
      alert(error.message);
      return;
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <main className="p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-wide">Tracklists</h1>

        <Link
          href="/tracklists/new"
          className="text-xs tracking-widest text-purple-300 hover:text-purple-200"
        >
          NEW
        </Link>
      </div>

      {loading && <p className="mt-6 text-gray-400">Loading…</p>}
      {err && <p className="mt-6 text-red-300">{err}</p>}

      {!loading && !err && items.length === 0 && (
        <p className="mt-6 text-gray-400">No Tracklists yet.</p>
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
    </main>
  );
}
