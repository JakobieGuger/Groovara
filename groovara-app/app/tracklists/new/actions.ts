"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import { writeAuditLog } from "@/lib/security/auditLog";

const createTracklistSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(120, "Title must be 120 characters or fewer."),
  description: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(1000, "Description must be 1000 characters or fewer.").nullable()
  ),
});

type CreateTracklistResult =
  | { ok: true; tracklistId: string }
  | {
      ok: false;
      type: "validation";
      fieldErrors: Record<string, string[] | undefined>;
      formErrors: string[];
    }
  | {
      ok: false;
      type: "auth" | "db" | "rate_limit";
      message: string;
      resetAtIso?: string;
    };

export async function createTracklistAction(
  rawInput: unknown
): Promise<CreateTracklistResult> {
  const parsed = createTracklistSchema.safeParse(rawInput);

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
      message: "You must be logged in to create a tracklist.",
    };
  }
    const rateLimit = await enforceRateLimit({
    action: "create_tracklist",
    ...RATE_LIMITS.create_tracklist,
    metadata: {
      source: "app/tracklists/new/actions.ts",
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
    .from("tracklists")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      type: "db",
      message: error?.message ?? "Failed to create tracklist.",
    };
  }

  await writeAuditLog({
    eventType: "tracklist_create",
    userId: user.id,
    resourceType: "tracklist",
    resourceId: data.id,
    success: true,
    metadata: {
      title: input.title,
      source: "app/tracklists/new/actions.ts",
    },
  });

  revalidatePath("/hub");

  return { ok: true, tracklistId: data.id };
}
