"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTracklistAction } from "./actions";

function getActionError(result: {
  type: string;
  message?: string;
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}) {
  if (result.type === "validation") {
    return (
      result.formErrors?.[0] ??
      Object.values(result.fieldErrors ?? {}).flat().find(Boolean) ??
      "Invalid tracklist input."
    );
  }

  return result.message ?? "Failed to create tracklist.";
}

export default function NewTracklistPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      const result = await createTracklistAction({
        title,
        description,
      });

      if (!result.ok) {
        throw new Error(getActionError(result));
      }

      router.push(`/tracklists/${result.tracklistId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create tracklist.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-10">
      <h1 className="text-2xl font-light tracking-wide">Create Tracklist</h1>

      <div className="mt-8 max-w-xl space-y-5">
        <div>
          <label className="block text-xs tracking-widest text-muted-foreground">
            TITLE
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={[
              "mt-2 w-full rounded-xl border px-4 py-3 outline-none transition",
              "border-border bg-card text-foreground placeholder:text-muted-foreground/70",
              "focus:border-[#5b3cc4]/50 focus:ring-2 focus:ring-[#5b3cc4]/15",
              "dark:focus:border-purple-500/40 dark:focus:ring-purple-500/20",
            ].join(" ")}
            placeholder="e.g. Songs that feel like home"
          />
        </div>

        <div>
          <label className="block text-xs tracking-widest text-muted-foreground">
            DESCRIPTION (OPTIONAL)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={[
              "mt-2 w-full rounded-xl border px-4 py-3 outline-none transition",
              "border-border bg-card text-foreground placeholder:text-muted-foreground/70",
              "focus:border-[#5b3cc4]/50 focus:ring-2 focus:ring-[#5b3cc4]/15",
              "dark:focus:border-purple-500/40 dark:focus:ring-purple-500/20",
            ].join(" ")}
            placeholder="Short context for the list…"
            rows={4}
          />
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={create}
            disabled={saving}
            className={[
              "rounded-full border px-6 py-3 text-xs tracking-widest transition disabled:opacity-50",
              "border-[#5b3cc4]/40 gv-accent text-[#4a2fb0] hover:bg-[#5b3cc4]/15",
              "dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-200 dark:hover:bg-purple-500/20",
            ].join(" ")}
          >
            {saving ? "CREATING…" : "CREATE"}
          </button>

          <Link
            href="/tracklists"
            className="text-xs tracking-widest text-muted-foreground transition hover:text-[#5b3cc4] dark:hover:text-purple-300"
          >
            CANCEL
          </Link>
        </div>
      </div>
    </main>
  );
}
