"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import { writeAuditLog } from "@/lib/security/auditLog";

const deleteMixlistSchema = z.object({
  mixlistId: z.string().uuid("Invalid mixlist id."),
});

type DeleteMixlistResult =
  | { ok: true }
  | {
      ok: false;
      type: "validation";
      fieldErrors: Record<string, string[] | undefined>;
      formErrors: string[];
    }
  | { ok: false; type: "auth" | "db" | "not_found" | "rate_limit"; message: string; resetAtIso?: string; };

export async function deleteMixlistAction(
  rawInput: unknown
): Promise<DeleteMixlistResult> {
  const parsed = deleteMixlistSchema.safeParse(rawInput);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      ok: false,
      type: "validation",
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    };
  }

  const { mixlistId } = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      type: "auth",
      message: "You must be logged in to delete a mixlist.",
    };
  }

    const rateLimit = await enforceRateLimit({
    action: "delete_mixlist",
    ...RATE_LIMITS.delete_mixlist,
    metadata: {
      source: "app/mixlists/actions.ts",
      mixlistId,
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

  const { data: existing, error: existingError } = await supabase
    .from("mixlists")
    .select("id,owner_user_id")
    .eq("id", mixlistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      type: "db",
      message: existingError.message ?? "Failed to verify mixlist ownership.",
    };
  }

  if (!existing) {
    return {
      ok: false,
      type: "not_found",
      message: "Mixlist not found or you do not have access to it.",
    };
  }

  await writeAuditLog({
    eventType: "mixlist_delete",
    userId: user.id,
    resourceType: "mixlist",
    resourceId: mixlistId,
    success: true,
    metadata: {
      source: "app/mixlists/actions.ts",
    },
  });

  const { error: childErr } = await supabase
    .from("mixlist_songs")
    .delete()
    .eq("mixlist_id", mixlistId);

  if (childErr) {
    return {
      ok: false,
      type: "db",
      message: childErr.message ?? "Failed to delete mixlist songs.",
    };
  }

  const { error } = await supabase.from("mixlists").delete().eq("id", mixlistId);

  if (error) {
    return {
      ok: false,
      type: "db",
      message: error.message ?? "Failed to delete mixlist.",
    };
  }

  revalidatePath("/mixlists");
  revalidatePath(`/mixlists/${mixlistId}`);

  return { ok: true };
}
