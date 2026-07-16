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

type YouTubeStatus = {
  connected: boolean;
  channelId?: string | null;
  channelTitle?: string | null;
  scope?: string | null;
  updatedAt?: string | null;
  error?: string;
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

  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);

  const [youtubeConnected, setYoutubeConnected] = useState<boolean | null>(null);
  const [youtubeChannelId, setYoutubeChannelId] = useState<string | null>(null);
  const [youtubeChannelTitle, setYoutubeChannelTitle] = useState<string | null>(null);
  const [disconnectingYoutube, setDisconnectingYoutube] = useState(false);

  useEffect(() => {
    const loadPlatformConnections = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const spotifyRequest = fetch("/api/spotify/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      })
        .then(async (res) => {
          const data = await res.json();
          setSpotifyConnected(Boolean(data.connected));
          setSpotifyProfile(data.profile ?? null);
        })
        .catch(() => {
          setSpotifyConnected(false);
          setSpotifyProfile(null);
        });

      const youtubeRequest = fetch("/api/youtube/status", {
        cache: "no-store",
      })
        .then(async (res) => {
          const data = (await res.json()) as YouTubeStatus;
          setYoutubeConnected(Boolean(data.connected));
          setYoutubeChannelId(data.channelId ?? null);
          setYoutubeChannelTitle(data.channelTitle ?? null);
        })
        .catch(() => {
          setYoutubeConnected(false);
          setYoutubeChannelId(null);
          setYoutubeChannelTitle(null);
        });

      await Promise.allSettled([spotifyRequest, youtubeRequest]);
    };

    void loadPlatformConnections();

    const youtubeResult = new URLSearchParams(window.location.search).get(
      "youtube",
    );

    if (youtubeResult === "connected") {
      setMsg("YouTube connected.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (youtubeResult === "denied") {
      setErr("YouTube connection was cancelled.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (youtubeResult) {
      setErr("YouTube could not be connected. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    const run = async () => {
      setLoading(true);

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

  const disconnectYoutube = async () => {
    if (disconnectingYoutube) return;

    setDisconnectingYoutube(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/youtube/disconnect", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setErr(data?.error ?? "YouTube could not be disconnected.");
        return;
      }

      setYoutubeConnected(false);
      setYoutubeChannelId(null);
      setYoutubeChannelTitle(null);
      setMsg("YouTube disconnected.");
    } catch {
      setErr("YouTube could not be disconnected.");
    } finally {
      setDisconnectingYoutube(false);
    }
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
                    setSettings((prev) =>
                      prev
                        ? { ...prev, default_reveal_mode: e.target.checked }
                        : prev,
                    )
                  }
                  className="h-5 w-5 accent-purple-500"
                />
              </label>

              <div className="h-px bg-border/70" />

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">
                    Default Include Song Notes
                  </p>
                  <p className="text-xs tracking-widest text-muted-foreground mt-1">
                    New mixlists show notes to recipients.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.default_include_song_notes}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            default_include_song_notes: e.target.checked,
                          }
                        : prev,
                    )
                  }
                  className="h-5 w-5 accent-purple-500"
                />
              </label>

              <div className="h-px bg-border/70" />

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">
                    Default Public Mixlists
                  </p>
                  <p className="text-xs tracking-widest text-muted-foreground mt-1">
                    New mixlists are accessible by link.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.default_is_public}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? { ...prev, default_is_public: e.target.checked }
                        : prev,
                    )
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
                <p className="text-xs tracking-widest text-muted-foreground">
                  PLATFORM CONNECTIONS
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Connect your streaming accounts to import and export
                  playlists.
                </p>

                <div className="mt-6">
                  <p className="text-xs tracking-widest text-muted-foreground">
                    SPOTIFY
                  </p>

                  {spotifyConnected === null ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Checking connection…
                    </p>
                  ) : spotifyConnected ? (
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
                            Connected
                            {spotifyProfile?.display_name
                              ? ` — ${spotifyProfile.display_name}`
                              : ""}
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
                      <p className="text-sm text-muted-foreground">
                        Not connected.
                      </p>
                      <a
                        className="mt-3 inline-flex rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-2 text-xs tracking-widest text-purple-800 hover:bg-purple-500/15 transition dark:text-purple-200"
                        href="/api/spotify/login"
                      >
                        CONNECT SPOTIFY
                      </a>
                    </div>
                  )}
                </div>

                <div className="my-6 h-px bg-border/70" />

                <div>
                  <p className="text-xs tracking-widest text-muted-foreground">
                    YOUTUBE
                  </p>

                  {youtubeConnected === null ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Checking connection…
                    </p>
                  ) : youtubeConnected ? (
                    <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-semibold text-red-700 dark:text-red-200">
                            ▶
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">
                              Connected
                              {youtubeChannelTitle
                                ? ` — ${youtubeChannelTitle}`
                                : ""}
                            </p>
                            {youtubeChannelId ? (
                              <a
                                className="text-xs text-red-700 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
                                href={`https://www.youtube.com/channel/${youtubeChannelId}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View channel →
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={disconnectYoutube}
                          disabled={disconnectingYoutube}
                          className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs tracking-widest text-red-700 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-200"
                        >
                          {disconnectingYoutube
                            ? "DISCONNECTING…"
                            : "DISCONNECT"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-border bg-background/40 p-5">
                      <p className="text-sm text-muted-foreground">
                        Not connected. Connect YouTube to export Mixlists as
                        YouTube playlists.
                      </p>
                      <a
                        className="mt-3 inline-flex rounded-full border border-purple-500/40 bg-purple-500/10 px-5 py-2 text-xs tracking-widest text-purple-800 hover:bg-purple-500/15 transition dark:text-purple-200"
                        href={`/api/youtube/connect?returnTo=${encodeURIComponent(
                          "/settings",
                        )}`}
                      >
                        CONNECT YOUTUBE
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}