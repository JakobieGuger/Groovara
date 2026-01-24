"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setLoggedIn(!!data.session);
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200">
      {/* Hero */}
      <section
        className="relative h-[65vh] bg-cover bg-center"
        style={{
          backgroundImage: "url('/gv_HomepageImage.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="text-center px-6">
            <p className="mb-6 text-xs tracking-[0.4em] text-purple-400">
              NOT A MIXTAPE. NOT A PLAYLIST.
            </p>

            <h2 className="text-2xl md:text-3xl font-light tracking-wide text-gray-100">
              Something new is coming.
            </h2>

            {/* Entry buttons */}
            <div className="mt-10 flex items-center justify-center gap-4">
              {!loggedIn ? (
                <Link
                  href="/login"
                  className="rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition"
                >
                  LOGIN
                </Link>
              ) : null}

              <Link
                href="/tracklists"
                className="rounded-full border border-gray-500/30 bg-white/5 px-6 py-3 text-xs tracking-widest text-gray-200 hover:bg-white/10 transition"
              >
                ENTER GROOVARA
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Message */}
      <section className="py-20 text-center px-6">
        <p className="text-lg font-light tracking-wide text-gray-300 mb-6">
          A fresh way to share the meanings inside your music.
        </p>
        <p className="text-sm tracking-widest text-purple-300">
          SIMPLE. PERSONAL. UNFORGETTABLE.
        </p>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-xs tracking-widest text-gray-500">
        © {new Date().getFullYear()} GROOVARA
      </footer>
    </main>
  );
}
