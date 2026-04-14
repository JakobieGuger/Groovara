"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type GoogleBetaState = {
  error: string;
  success: string;
};

const GOOGLE_BETA_COOKIE = "groovara_google_beta_code";

export async function prepareGoogleBetaAction(
  _prevState: GoogleBetaState,
  formData: FormData
): Promise<GoogleBetaState> {
  const betaCode = String(formData.get("betaCode") || "").trim();
  const next = String(formData.get("next") || "/hub");

  if (!betaCode) {
    return { error: "Please enter a beta code.", success: "" };
  }

  const admin = createAdminClient();

  const { data: codeRow, error: codeError } = await admin
    .from("beta_codes")
    .select("id, code, is_active, max_uses, used_count, expires_at")
    .eq("code", betaCode)
    .maybeSingle();

  if (codeError) {
    return { error: "Failed to validate beta code.", success: "" };
  }

  if (!codeRow) {
    return { error: "That code didn’t work. Check it and try again.", success: "" };
  }

  if (!codeRow.is_active) {
    return { error: "That code didn’t work. Check it and try again.", success: "" };
  }

  if (codeRow.expires_at && new Date(codeRow.expires_at) <= new Date()) {
    return { error: "That code didn’t work. Check it and try again.", success: "" };
  }

  if (codeRow.used_count >= codeRow.max_uses) {
    return { error: "That code didn’t work. Check it and try again.", success: "" };
  }

  const cookieStore = await cookies();

  cookieStore.set(GOOGLE_BETA_COOKIE, betaCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15, // 15 minutes
  });

  redirect(`/auth/google/start?next=${encodeURIComponent(next)}`);
}