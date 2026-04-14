"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type GoogleStartProps = {
  next: string;
};

export default function GoogleStart({ next }: GoogleStartProps) {
  useEffect(() => {
    const run = async () => {
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
        console.error("Google OAuth start failed:", error);
        window.location.href = "/login?error=google_start_failed";
      }
    };

    void run();
  }, [next]);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 text-center shadow-xl backdrop-blur">
        <h1 className="text-2xl font-light tracking-wide">Redirecting to Google</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hold on a second.
        </p>
      </div>
    </main>
  );
}