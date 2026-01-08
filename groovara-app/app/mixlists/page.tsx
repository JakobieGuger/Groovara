"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import InlineNotice from "../../lib/InlineNotice";

type MixlistRow = {
  id: string;
  title: string | null;
  message: string | null;
  created_at: string | null;
};

export default function MixlistsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<MixlistRow[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
      // Protected should prevent this, but keep it safe
      setErr("You must be logged in to view your mixlists.");
      setLoading(false);
      return;
    }

    // IMPORTANT: assumes your mixlists table has owner_user_id + created_at
    const { data, error } = await supabase
      .from("mixlists")
      .select("id,title,message,created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as MixlistRow[]);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const ok = confirm("Delete this mixlist? This can’t be undone.");
    if (!ok) return;

    // Delete children first if you don't have ON DELETE CASCADE
    // If you DO have cascade, you can remove this block.
    const { error: childErr } = await supabase
      .from("mixlist_songs")
      .delete()
      .eq("mixlist_id", id);

    if (childErr) {
      setErr(childErr.message);
      return;
    }

    const { error } = await supabase.from("mixlists").delete().eq("id", id);

    if (error) {
      setErr(error.message);
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function loadInitial() {
  setErr(null);

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    setErr("You must be logged in to view your mixlists.");
    setLoading(false);
    return;
  }

  const { data, error } = await supabase
    .from("mixlists")
    .select("id,title,message,created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    setErr(error.message);
    setItems([]);
    setLoading(false);
    return;
  }

  setItems((data ?? []) as MixlistRow[]);
  setLoading(false);
}

    useEffect(() => {
      const t = setTimeout(() => {
        void loadInitial();
      }, 0);

      return () => clearTimeout(t);
    }, []);


  return (
    <main className="p-6 text-white/90">
      <div className="max-w-2xl flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-wide">My Mixlists</h1>

        <button
          onClick={load}
          className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
        >
          REFRESH
        </button>
      </div>

      {loading && <p className="mt-6 text-gray-400">Loading…</p>}

      {!loading && err && (
        <div className="mt-6">
          <InlineNotice
            kind="error"
            title="Couldn’t load your mixlists"
            message={err}
          />
        </div>
      )}

      {!loading && !err && items.length === 0 && (
        <div className="mt-6">
          <InlineNotice
            kind="info"
            title="No mixlists yet"
            message="Create one from a tracklist, then share it."
          />
        </div>
      )}

      {!loading && !err && items.length > 0 && (
        <div className="mt-6 max-w-2xl space-y-3">
          {items.map((m) => {
            const created =
              m.created_at ? new Date(m.created_at).toLocaleString() : null;

            return (
              <div
                key={m.id}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/mixlists/${m.id}`}
                      className="block text-sm font-medium text-white/90 hover:text-purple-300 transition truncate"
                    >
                      {m.title?.trim() ? m.title : "Untitled mixlist"}
                    </Link>
                                
                    {m.message?.trim() && (
                      <div className="mt-1 text-xs text-white/50 truncate">
                        {m.message}
                      </div>
                    )}


                    {created && (
                      <div className="mt-1 text-xs text-white/50 tracking-wide">
                        {created}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(m.id)}
                    className="shrink-0 text-xs tracking-widest text-red-300 hover:text-red-200 transition"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
