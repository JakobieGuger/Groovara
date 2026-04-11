"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import { writeAuditLog } from "@/lib/security/auditLog";

const saveSettingsSchema = z.object({
  default_reveal_mode: z.boolean(),
  default_include_song_notes: z.boolean(),
  default_is_public: z.boolean(),
});

type UserSettingsRow = {
  user_id: string;
  default_reveal_mode: boolean;
  default_include_song_notes: boolean;
  default_is_public: boolean;
};

type LoadOrInitSettingsResult =
  | { ok: true; settings: UserSettingsRow }
  | { ok: false; type: "auth" | "db" | "rate_limit"; message: string; resetAtIso?: string; };

type SaveSettingsResult =
  | { ok: true; settings: UserSettingsRow }
  | {
      ok: false;
      type: "validation";
      fieldErrors: Record<string, string[] | undefined>;
      formErrors: string[];
    }
  | { ok: false; type: "auth" | "db" | "rate_limit"; message: string; resetAtIso?: string; };

export async function loadOrInitializeSettingsAction(): Promise<LoadOrInitSettingsResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      type: "auth",
      message: "You must be logged in to view settings.",
    };
  }

    const rateLimit = await enforceRateLimit({
    action: "save_settings",
    ...RATE_LIMITS.save_settings,
    metadata: {
      source: "app/settings/actions.ts",
    },
  });

  if (!rateLimit.ok) {
    return {
      ok: false,
      type: "rate_limit",
      message: rateLimit.message,
      resetAtIso: rateLimit.resetAtIso,
    };
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id,default_reveal_mode,default_include_song_notes,default_is_public")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      type: "db",
      message: "Failed to load settings.",
    };
  }

  if (data) {
    return {
      ok: true,
      settings: data as UserSettingsRow,
    };
  }

  const defaults = {
    user_id: user.id,
    default_reveal_mode: true,
    default_include_song_notes: true,
    default_is_public: true,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("user_settings")
    .upsert(defaults, { onConflict: "user_id" })
    .select("user_id,default_reveal_mode,default_include_song_notes,default_is_public")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      type: "db",
      message: "Failed to initialize settings.",
    };
  }

  revalidatePath("/settings");

  return {
    ok: true,
    settings: inserted as UserSettingsRow,
  };
}

export async function saveSettingsAction(
  rawInput: unknown
): Promise<SaveSettingsResult> {
  const parsed = saveSettingsSchema.safeParse(rawInput);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      ok: false,
      type: "validation",
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      type: "auth",
      message: "You must be logged in to save settings.",
    };
  }

  const payload = {
    user_id: user.id,
    default_reveal_mode: input.default_reveal_mode,
    default_include_song_notes: input.default_include_song_notes,
    default_is_public: input.default_is_public,
  };

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id,default_reveal_mode,default_include_song_notes,default_is_public")
    .single();

  if (error || !data) {
    return {
      ok: false,
      type: "db",
      message: "Failed to save settings.",
    };
  }

  await writeAuditLog({
    eventType: "settings_update",
    userId: user.id,
    resourceType: "user_settings",
    resourceId: user.id,
    success: true,
    metadata: {
      default_reveal_mode: input.default_reveal_mode,
      default_include_song_notes: input.default_include_song_notes,
      default_is_public: input.default_is_public,
      source: "app/settings/actions.ts",
    },
  });

  revalidatePath("/settings");

  return {
    ok: true,
    settings: data as UserSettingsRow,
  };
}
