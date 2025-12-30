"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";


type Tracklist = {
  id: string;
  title: string;
  description: string | null;
};

export default function TracklistDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [item, setItem] = useState<Tracklist | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tracklists")
      .select("id,title,description")
      .eq("id", id)
      .single();

    if (error) {
      alert(error.message);
      router.replace("/tracklists");
      return;
    }

    const t = data as Tracklist;
    setItem(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [id]);


  const save = async () => {
    if (!item) return;
    const trimmed = title.trim();
    if (!trimmed) return alert("Title is required.");

    setSaving(true);
    const { error } = await supabase
      .from("tracklists")
      .update({
        title: trimmed,
        description: description.trim() || null,
      })
      .eq("id", id);

    setSaving(false);

    if (error) return alert(error.message);

    setItem({ ...item, title: trimmed, description: description.trim() || null });
    alert("Saved.");
  };

  const remove = async () => {
    if (!confirm("Delete this tracklist?")) return;

    const { error } = await supabase.from("tracklists").delete().eq("id", id);
    if (error) return alert(error.message);

    router.replace("/tracklists");
  };

  if (loading) {
    return (
      <main className="p-10">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{item?.title}</h1>
          <p className="mt-1 text-xs tracking-widest text-gray-500">
            TRACKLIST ID: {id}
          </p>
        </div>

        <button
          onClick={remove}
          className="text-xs tracking-widest text-gray-400 hover:text-red-300 transition"
        >
          DELETE
        </button>
      </div>

      <div className="mt-10 max-w-xl space-y-4">
        <div>
          <label className="block text-xs tracking-widest text-gray-400">
            TITLE
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
          />
        </div>

        <div>
          <label className="block text-xs tracking-widest text-gray-400">
            DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            rows={5}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
          >
            {saving ? "SAVING…" : "SAVE"}
          </button>

          <Link
            href="/tracklists"
            className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
          >
            ← BACK
          </Link>
        </div>
      </div>

      {/* Songs UI comes next */}
      <div className="mt-14 border-t border-white/10 pt-10">
        <h2 className="text-lg font-light tracking-wide">Songs</h2>
        <p className="mt-2 text-sm text-gray-400">
          Next: basic search + add songs to this tracklist.
        </p>
      </div>
    </main>
  );
}
