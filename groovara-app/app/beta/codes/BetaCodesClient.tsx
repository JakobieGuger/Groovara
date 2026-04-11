"use client";

import { useActionState } from "react";
import { createBetaCodeAction } from "../actions";

const initialState = {
  error: "",
  success: "",
  code: "",
};

export default function BetaCodesClient() {
  const [state, formAction, pending] = useActionState(
    createBetaCodeAction,
    initialState
  );

  const inviteUrl =
    state.code && typeof window !== "undefined"
      ? `${window.location.origin}/beta?code=${encodeURIComponent(state.code)}`
      : "";

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-light tracking-wide">Beta Code Generator</h1>
          <p className="text-sm text-muted-foreground">
            Temporary internal tool for generating beta invite codes.
          </p>
        </div>

        <form action={formAction} className="mt-8">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {pending ? "GENERATING..." : "GENERATE CODE"}
          </button>
        </form>

        {state.error ? (
          <p className="mt-4 text-sm text-red-400">{state.error}</p>
        ) : null}

        {state.success && !state.code ? (
          <p className="mt-4 text-sm text-green-400">{state.success}</p>
        ) : null}

        {state.code ? (
          <div className="mt-6 space-y-4 rounded-2xl border border-border bg-background/60 p-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Beta Code
              </p>
              <p className="mt-2 text-xl font-medium tracking-wide text-foreground">
                {state.code}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Invite Link
              </p>
              <p className="mt-2 break-all text-sm text-foreground/90">
                {inviteUrl}
              </p>
            </div>

            {state.success ? (
              <p className="text-sm text-green-400">{state.success}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}