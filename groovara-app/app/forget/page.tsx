"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setPending(true);

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "";

      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${origin}/reset-password`,
        }
      );

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(
        "If an account exists for that email, a password reset link has been sent."
      );
      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected error sending reset email."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-light tracking-wide text-center">
          Reset Password
        </h1>

        <p className="mt-3 text-sm text-gray-400 text-center">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-gray-400">
              Email
            </label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="you@example.com"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-green-400">{success}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {pending ? "SENDING..." : "SEND RESET LINK"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          <Link href="/login" className="text-purple-300 hover:text-purple-200">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}