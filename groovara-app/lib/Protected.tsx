"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const POLICY_VERSION = "youtube-compliance-2026-06";

type Status = "checking" | "accepted" | "needs_acceptance" | "saving" | "error";

export function Protected({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session?.user) {
        setStatus("checking");
        return;
      }

      const { data, error: acceptanceError } = await supabase
        .from("user_policy_acceptances")
        .select("terms_version, privacy_version, accepted_at")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (acceptanceError) {
        setError(acceptanceError.message);
        setStatus("error");
        return;
      }

      const hasAcceptedCurrentPolicy =
        data?.terms_version === POLICY_VERSION &&
        data?.privacy_version === POLICY_VERSION &&
        Boolean(data?.accepted_at);

      setStatus(hasAcceptedCurrentPolicy ? "accepted" : "needs_acceptance");
    };

    check();

    return () => {
      isMounted = false;
    };
  }, []);

  const acceptPolicies = async () => {
    if (!checked) return;

    setStatus("saving");
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(userError?.message || "You must be signed in to continue.");
      setStatus("error");
      return;
    }

    const { error: acceptanceError } = await supabase
      .from("user_policy_acceptances")
      .upsert(
        {
          user_id: user.id,
          terms_version: POLICY_VERSION,
          privacy_version: POLICY_VERSION,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (acceptanceError) {
      setError(acceptanceError.message);
      setStatus("error");
      return;
    }

    setStatus("accepted");
  };

  if (status === "checking" || status === "saving") {
    return (
      <main className="min-h-screen bg-background px-6 py-24 text-foreground">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/80 p-8 text-center shadow-lg">
          <p className="text-sm text-muted-foreground">
            {status === "saving" ? "Saving acceptance..." : "Checking account..."}
          </p>
        </div>
      </main>
    );
  }

  if (status === "needs_acceptance" || status === "error") {
    return (
      <main className="min-h-screen bg-background px-6 py-24 text-foreground">
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card/85 p-8 shadow-lg">
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Groovara Policy Update
          </p>

          <h1 className="text-2xl font-semibold tracking-tight">
            Please review Groovara&apos;s terms and privacy policy
          </h1>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            To keep using Groovara, you need to agree to the current Terms of Use
            and Privacy Policy. Groovara uses YouTube API Services, and
            YouTube-powered features are also subject to the YouTube Terms of
            Service.
          </p>

          <div className="mt-5 space-y-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
            <Link
              href="/terms"
              target="_blank"
              className="block font-medium text-[#57577F] underline underline-offset-4"
            >
              Open Groovara Terms of Use
            </Link>

            <Link
              href="/privacy"
              target="_blank"
              className="block font-medium text-[#57577F] underline underline-offset-4"
            >
              Open Groovara Privacy Policy
            </Link>

            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noreferrer"
              className="block font-medium text-[#57577F] underline underline-offset-4"
            >
              Open YouTube Terms of Service
            </a>
          </div>

          <label className="mt-5 flex gap-3 rounded-2xl border border-border bg-background/35 p-4 text-sm leading-6 text-muted-foreground">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#57577F]"
            />
            <span>
              I agree to Groovara&apos;s Terms of Use and Privacy Policy and
              understand that YouTube-powered features are also subject to the
              YouTube Terms of Service.
            </span>
          </label>

          {error ? (
            <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={acceptPolicies}
            disabled={!checked}
            className="mt-6 w-full rounded-full bg-[#57577F] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agree and Continue
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
