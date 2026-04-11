"use client";

import { useEffect, useState } from "react";
import InlineNotice from "../../lib/InlineNotice";
import { supabase } from "../../lib/supabaseClient";
import {
  loadOrInitializeSettingsAction,
  saveSettingsAction,
} from "./actions";

type UserSettings = {
  user_id: string;
  default_reveal_mode: boolean;
  default_include_song_notes: boolean;
  default_is_public: boolean;
};

type SpotifyProfile = {
  spotify_user_id: string | null;
  display_name: string | null;
  profile_url: string | null;
  image_url: string | null;
};

function getActionError(result: {
  type: string;
  message?: string;
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}) {
  if (result.type === "validation") {
    return (
      result.formErrors?.[0] ??
      Object.values(result.fieldErrors ?? {}).flat().find(Boolean) ??
      "Invalid settings input."
    );
  }

  return result.message ?? "Something went wrong.";
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch("/api/spotify/status", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });

        const data = await res.json();
        setConnected(Boolean(data.connected));
        setSpotifyProfile(data.profile ?? null);
      } catch {
        setConnected(false);
        setSpotifyProfile(null);
      }
    })();

    const run = async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const result = await loadOrInitializeSettingsAction();

      if (!result.ok) {
        setSettings(null);
        setErr(result.message);
        setLoading(false);
        return;
      }

      setSettings(result.settings);
      setLoading(false);
    };

    void run();
  }, []);

  const save = async () => {
    if (!settings) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    const result = await saveSettingsAction({
      default_reveal_mode: settings.default_reveal_mode,
      default_include_song_notes: settings.default_include_song_notes,
      default_is_public: settings.default_is_public,
    });

    setSaving(false);

    if (!result.ok) {
      setErr(getActionError(result));
      return;
    }

    setSettings(result.settings);
    setMsg("Saved.");
    window.setTimeout(() => setMsg(null), 1200);
  };

  if (loading) {
    return (
      <main className="gv-paper-bg min-h-screen">
        <div className="gv-paper-content p-10">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content p-10">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-light tracking-wide">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These defaults apply when you create new mixlists.
          </p>

          {err ? (
            <div className="mt-6">
              <InlineNotice kind="error" title="Settings" message={err} />
            </div>
          ) : null}

          {msg ? (
            <div className="mt-6">
              <InlineNotice kind="info" message={msg} />
            </div>
          ) : null}

          {settings ? (
            <div className="mt-8 rounded-2xl border border-border bg-card/80 p-6 space-y-5 shadow-sm">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">Default Reveal Mode</p>
                  <p className="text-xs tracking-widest text-muted-foreground mt-1">
                    New mixlists start in reveal mode.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.default_reveal_mode}
                  onChange={(e) =>
                    setSettings((prev) => (prev ? { ...prev, default_reveal_mode: e.target.checked } : prev))
                  }
                  className="h-5 w-5 accent-purple-500"
                />
              </label>

              <div className="h-px bg-border/70" />

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">Default Include Song Notes</p>
                  <p className="text-xs tracking-widest text-muted-foreground mt-1">
                    New mixlists show notes to recipients.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.default_include_song_notes}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, default_include_song_notes: e.target.checked } : prev
                    )
                  }
                  className="h-5 w-5 accent-purple-500"
                />
              </label>

              <div className="h-px bg-border/70" />

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">Default Public Mixlists</p>
                  <p className="text-xs tracking-widest text-muted-foreground mt-1">
                    New mixlists are accessible by link.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.default_is_public}
                  onChange={(e) =>
                    setSettings((prev) => (prev ? { ...prev, default_is_public: e.target.checked } : prev))
                  }
                  className="h-5 w-5 accent-purple-500"
                />
              </label>

              <button
                onClick={save}
                disabled={saving}
                className="mt-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-800 hover:bg-purple-500/15 transition disabled:opacity-50 dark:text-purple-200"
              >
                {saving ? "SAVING…" : "SAVE"}
              </button>

              <div className="h-px bg-border/70" />

              <div className="pt-2">
                <p className="text-xs tracking-widest text-muted-foreground">SPOTIFY</p>

                {connected === null ? (
                  <p className="mt-3 text-sm text-muted-foreground">Checking connection…</p>
                ) : connected ? (
                  <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                    <div className="flex items-center gap-3">
                      {spotifyProfile?.image_url ? (
                        <img
                          src={spotifyProfile.image_url}
                          alt=""
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-green-500/20" />
                      )}

                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">
                          Connected{spotifyProfile?.display_name ? ` — ${spotifyProfile.display_name}` : ""}
                        </p>
                        {spotifyProfile?.profile_url ? (
                          <a
                            className="text-xs text-green-700 hover:text-green-900 dark:text-green-200 dark:hover:text-green-100"
                            href={spotifyProfile.profile_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View profile →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-border bg-background/40 p-5">
                    <p className="text-sm text-muted-foreground">Not connected.</p>
                    <a
                      className="mt-3 inline-flex rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-2 text-xs tracking-widest text-purple-800 hover:bg-purple-500/15 transition dark:text-purple-200"
                      href="/api/spotify/login"
                    >
                      CONNECT SPOTIFY
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
