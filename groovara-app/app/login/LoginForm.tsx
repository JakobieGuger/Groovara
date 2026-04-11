"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";
import { supabase } from "../../lib/supabaseClient";

const initialState = {
  error: "",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  const signInWithGoogle = async () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      alert(error.message);
    }
  };

return (
  <main className="min-h-screen bg-[#0b0a0f] text-gray-200 flex items-center justify-center p-6">
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
      <h1 className="text-2xl font-light tracking-wide text-center">Login</h1>
      <p className="mt-3 text-sm text-gray-400 text-center">
        Sign in to create Tracklists and send Mixlists.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-gray-400">
            Email
          </label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-gray-400">
            Password
          </label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
            placeholder="••••••••"
          />
        </div>
        {state?.error ? (
          <p className="text-sm text-red-400">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-50"
        >
          {pending ? "SIGNING IN..." : "SIGN IN"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs tracking-widest text-gray-500">OR</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 transition hover:bg-purple-500/20"
      >
        CONTINUE WITH GOOGLE
      </button>

      <p className="mt-6 text-center text-sm text-gray-400">
        Don&apos;t have an account?{" "}
        <a
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="text-purple-300 hover:text-purple-200"
        >
          Sign up
        </a>
      </p>
            
      <p className="mt-2 text-center text-sm text-gray-400">
        <a
          href="/forget"
          className="text-purple-300 hover:text-purple-200"
        >
          Forgot password?
        </a>
      </p>
    </div>
  </main>
);
}