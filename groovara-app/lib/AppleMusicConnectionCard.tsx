"use client";

import { useEffect, useState } from "react";
import {
  disconnectAppleMusic,
  ensureAppleMusicAuthorized,
  getAppleMusicAuthorizationState,
} from "@/lib/appleMusicClient";

type ConnectionState = "checking" | "connected" | "disconnected" | "error";

export default function AppleMusicConnectionCard() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getAppleMusicAuthorizationState()
      .then((status) => {
        if (!active) return;
        setState(status.connected ? "connected" : "disconnected");
      })
      .catch((error) => {
        if (!active) return;
        console.error("Apple Music connection check failed", error);
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Apple Music could not be initialized.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    if (working) return;

    setWorking(true);
    setMessage(null);

    try {
      await ensureAppleMusicAuthorized();
      setState("connected");
      setMessage("Apple Music connected.");
    } catch (error) {
      console.error("Apple Music authorization failed", error);
      setState("disconnected");
      setMessage(
        error instanceof Error
          ? error.message
          : "Apple Music authorization was not completed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    if (working) return;

    setWorking(true);
    setMessage(null);

    try {
      await disconnectAppleMusic();
      setState("disconnected");
      setMessage("Apple Music disconnected.");
    } catch (error) {
      console.error("Apple Music disconnect failed", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Apple Music could not be disconnected.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <p className="text-xs tracking-widest text-muted-foreground">
        APPLE MUSIC
      </p>

      {state === "checking" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Checking connection…
        </p>
      ) : state === "connected" ? (
        <div className="mt-4 rounded-2xl border border-[#5B4B6E]/25 bg-[#5B4B6E]/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 text-lg text-foreground dark:bg-white/10">
                ♪
              </div>

              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  Connected to Apple Music
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Groovara can create playlists in your Apple Music library.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={working}
              className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs tracking-widest text-red-700 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-200"
            >
              {working ? "DISCONNECTING…" : "DISCONNECT"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-background/40 p-5">
          <p className="text-sm text-muted-foreground">
            Connect Apple Music to export Mixlists as playlists in your
            library.
          </p>

          <button
            type="button"
            onClick={() => void connect()}
            disabled={working}
            className="mt-3 inline-flex rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-2 text-xs tracking-widest text-purple-800 transition hover:bg-purple-500/15 disabled:opacity-50 dark:text-purple-200"
          >
            {working ? "CONNECTING…" : "CONNECT APPLE MUSIC"}
          </button>
        </div>
      )}

      {message ? (
        <p
          className={`mt-3 text-xs ${
            state === "error"
              ? "text-red-700 dark:text-red-300"
              : "text-muted-foreground"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
