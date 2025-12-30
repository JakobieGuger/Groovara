"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { requireUserId } from "../../../lib/auth";

export default function NewTracklistPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed) return alert("Title is required.");

    setSaving(true);
    try {
      const userId = await requireUserId();

      const { data, error } = await supabase
        .from("tracklists")
        .insert({
          user_id: userId,
          title: trimmed,
          description: description.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      router.push(`/tracklists/${data.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create tracklist.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-10">
      <h1 className="text-2xl font-light tracking-wide">Create Tracklist</h1>

      <div className="mt-8 max-w-xl space-y-4">
        <div>
          <label className="block text-xs tracking-widest text-gray-400">
            TITLE
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            placeholder="e.g. Songs that feel like home"
          />
        </div>

        <div>
          <label className="block text-xs tracking-widest text-gray-400">
            DESCRIPTION (OPTIONAL)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 outline-none focus:border-purple-500/40"
            placeholder="Short context for the list…"
            rows={4}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={create}
            disabled={saving}
            className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
          >
            {saving ? "CREATING…" : "CREATE"}
          </button>

          <Link
            href="/tracklists"
            className="text-xs tracking-widest text-gray-400 hover:text-purple-300 transition"
          >
            CANCEL
          </Link>
        </div>
      </div>
    </main>
  );
}
