"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signupAction } from "./actions";

const initialState = {
  error: "",
  success: "",
};

export default function SignupPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/hub";
  const codeFromUrl = searchParams.get("code") || "";
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-light tracking-wide text-center">Sign Up</h1>
        <p className="mt-3 text-sm text-gray-400 text-center">
          Create an account to start building Tracklists and Mixlists.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />

          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
          />

          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Password"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
          />

          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Confirm Password"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
          />

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-gray-400">
              Beta Code
            </label>
            <input
              name="betaCode"
              type="text"
              required
              defaultValue={codeFromUrl}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="Enter your beta code"
            />
          </div>

          {state?.error ? (
            <p className="text-sm text-red-400">{state.error}</p>
          ) : null}

          {state?.success ? (
            <p className="text-sm text-green-400">{state.success}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {pending ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <a
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-purple-300 hover:text-purple-200"
          >
            Login
          </a>
        </p>
      </div>
    </main>
  );
}