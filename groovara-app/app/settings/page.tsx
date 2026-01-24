"use client";

import { useEffect, useState } from "react";
import InlineNotice from "../../lib/InlineNotice";
import { supabase } from "../../lib/supabaseClient";

type UserSettings = {
  user_id: string;
  default_reveal_mode: boolean;
  default_include_song_notes: boolean;
  default_is_public: boolean;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      if (userErr || !uid) {
        setUserId(null);
        setSettings(null);
        setErr("You must be logged in to view settings.");
        setLoading(false);
        return;
      }

      setUserId(uid);

      // Try load existing settings
      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id,default_reveal_mode,default_include_song_notes,default_is_public")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        setErr("Failed to load settings.");
        setLoading(false);
        return;
      }

      // If none, insert defaults
      if (!data) {
        const defaults: UserSettings = {
          user_id: uid,
          default_reveal_mode: true,
          default_include_song_notes: true,
          default_is_public: true,
        };

        const { data: inserted, error: insErr } = await supabase
          .from("user_settings")
          .upsert(defaults)
          .select("user_id,default_reveal_mode,default_include_song_notes,default_is_public")
          .single();

        if (insErr || !inserted) {
          setErr("Failed to initialize settings.");
          setLoading(false);
          return;
        }

        setSettings(inserted as UserSettings);
        setLoading(false);
        return;
      }

      setSettings(data as UserSettings);
      setLoading(false);
    };

    void run();
  }, []);

  const save = async () => {
    if (!userId || !settings) return;

    setSaving(true);
    setErr(null);
    setMsg(null);

    const { error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: userId,
          default_reveal_mode: settings.default_reveal_mode,
          default_include_song_notes: settings.default_include_song_notes,
          default_is_public: settings.default_is_public,
        },
        { onConflict: "user_id" }
      );

    setSaving(false);

    if (error) {
      setErr("Failed to save settings.");
      return;
    }

    setMsg("Saved.");
    window.setTimeout(() => setMsg(null), 1200);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0a0f] text-gray-200 p-10">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200 p-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-light tracking-wide text-gray-100">Settings</h1>
        <p className="mt-2 text-sm text-gray-400">
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
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-200">Default Reveal Mode</p>
                <p className="text-xs tracking-widest text-gray-500 mt-1">
                  New mixlists start in reveal mode.
                </p>
              </div>

              <input
                type="checkbox"
                checked={settings.default_reveal_mode}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, default_reveal_mode: e.target.checked } : prev
                  )
                }
                className="h-5 w-5 accent-purple-500"
              />
            </label>

            <div className="h-px bg-white/10" />

            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-200">Default Include Song Notes</p>
                <p className="text-xs tracking-widest text-gray-500 mt-1">
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

            <div className="h-px bg-white/10" />

            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-200">Default Public Mixlists</p>
                <p className="text-xs tracking-widest text-gray-500 mt-1">
                  New mixlists are accessible by link.
                </p>
              </div>

              <input
                type="checkbox"
                checked={settings.default_is_public}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, default_is_public: e.target.checked } : prev
                  )
                }
                className="h-5 w-5 accent-purple-500"
              />
            </label>

            <button
              onClick={save}
              disabled={saving}
              className="mt-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs tracking-widest text-purple-200 hover:bg-purple-500/20 transition disabled:opacity-50"
            >
              {saving ? "SAVING…" : "SAVE"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
