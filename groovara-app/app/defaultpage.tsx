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
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content">
        {/* Hero */}
        <section
          className={[
            "relative h-[65vh] bg-cover bg-center",
            // Light mode image
            "bg-[url('/gv_HomepageImage_L.jpg')]",
            // Dark mode image
            "dark:bg-[url('/gv_HomepageImage.JPG')]",
          ].join(" ")}
        >
          {/* LIGHT MODE: parchment wash + gentle vignette */}
          <div className="absolute inset-0 dark:hidden" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(1200px 820px at 50% 18%, rgba(236,223,202,0.70), rgba(236,223,202,0.55) 45%, rgba(224,206,180,0.72))",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(1100px 700px at 50% 45%, rgba(0,0,0,0), rgba(40,30,20,0.10))",
              }}
            />
          </div>

          {/* DARK MODE: keep a cinematic dark overlay */}
          <div className="absolute inset-0 hidden bg-black/55 dark:block" aria-hidden />

          <div className="relative z-10 flex h-full items-center justify-center">
            <div className="text-center px-6">
              <p className="mb-6 text-xs tracking-[0.4em] text-purple-700/80 dark:text-purple-300">
                NOT A MIXTAPE. NOT A PLAYLIST.
              </p>

                <h2
                  className="text-2xl md:text-3xl font-light tracking-wide"
                  style={{ color: "#fff" }}
                >
                  Something new is coming.
                </h2>

              {/* Entry buttons */}
              <div className="mt-10 flex items-center justify-center gap-4">
                {!loggedIn ? (
                  <Link
                    href="/login"
                    className={[
                      "rounded-full border px-6 py-3 text-xs tracking-widest transition",
                      "border-purple-500/40 bg-purple-500/10 text-purple-900 hover:bg-purple-500/15",
                      "dark:text-purple-200 dark:hover:bg-purple-500/20",
                    ].join(" ")}
                  >
                    LOGIN
                  </Link>
                ) : null}

                <Link
                  href="/hub"
                  className={[
                    "rounded-full border px-6 py-3 text-xs tracking-widest transition",
                    "border-border bg-card/80 text-foreground hover:bg-card",
                    "dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  ENTER GROOVARA
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Message */}
        <section className="py-20 text-center px-6">
          <p className="text-lg font-light tracking-wide text-muted-foreground mb-6">
            A fresh way to share the meanings inside your music.
          </p>
          <p className="text-sm tracking-widest gv-accent">
            SIMPLE. PERSONAL. UNFORGETTABLE.
          </p>
        </section>

        {/* Footer */}
        <footer className="py-10 text-center text-xs tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} GROOVARA
        </footer>
      </div>
    </main>
  );
}