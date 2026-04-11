"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password || !confirmPassword) {
      setError("Please fill out both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess("Password updated successfully. You can now use your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected error updating password."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-light tracking-wide text-center">
          Set New Password
        </h1>

        <p className="mt-3 text-sm text-gray-400 text-center">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-gray-400">
              New Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-gray-400">
              Confirm New Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-green-400">{success}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {pending ? "UPDATING..." : "UPDATE PASSWORD"}
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