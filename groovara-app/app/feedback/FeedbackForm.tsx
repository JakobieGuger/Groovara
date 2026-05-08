"use client";

import { useActionState, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { submitFeedbackAction } from "./actions";
import CharacterCounter from "@/lib/CharacterCounter";

const initialState = {
  error: "",
  success: "",
};

export default function FeedbackForm() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || pathname;
  const [message, setMessage] = useState("");

  const [state, formAction, pending] = useActionState(
    submitFeedbackAction,
    initialState
  );

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-light tracking-wide">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Found a bug, have a suggestion, or want to tell me what feels off?
            Drop it here.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-4">
          <input type="hidden" name="page" value={from} />

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Category
            </label>
            <select
              name="category"
              defaultValue=""
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground outline-none"
            >
              <option value="">General</option>
              <option value="bug">Bug</option>
              <option value="ui">UI / UX</option>
              <option value="feature">Feature Request</option>
              <option value="performance">Performance</option>
              <option value="music_data">Song / Platform Issue</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Feedback
            </label>
            <textarea
              name="message"
              required
              rows={7}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened, what felt wrong, or what would make this better?"
              className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground outline-none resize-y"
            />
            <CharacterCounter value={message} max={2000} />
          </div>

          {state.error ? (
            <p className="text-sm text-red-400">{state.error}</p>
          ) : null}

          {state.success ? (
            <p className="text-sm text-green-400">{state.success}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {pending ? "SUBMITTING..." : "SUBMIT FEEDBACK"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/hub" className="text-purple-300 hover:text-purple-200">
            Back to Hub
          </Link>
        </p>
      </div>
    </main>
  );
}