"use client";

import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/tracklists`,
      },
    });

    if (error) alert(error.message);
  };
  
  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-2xl font-light tracking-wide">Login</h1>
        <p className="mt-3 text-sm text-gray-400">
          Sign in to create Tracklists and send Mixlists.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-8 w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition"
        >
          CONTINUE WITH GOOGLE
        </button>
      </div>
    </main>
  );
}
