"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerEvent } from "@/lib/analyticsServer";

const POLICY_VERSION = "youtube-compliance-2026-06";

type SignupState = {
  error: string;
  success: string;
};

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  const betaCode = String(formData.get("betaCode") || "").trim();
  const next = String(formData.get("next") || "/hub");
  const acceptedPolicies = formData.get("acceptedPolicies") === "on";

  if (!email || !password || !confirm || !betaCode) {
    return { error: "All fields are required.", success: "" };
  }

  if (!acceptedPolicies) {
    return {
      error: "You must agree to Groovara's Terms of Use and Privacy Policy.",
      success: "",
    };
  }

  if (password !== confirm) {
    return { error: "Passwords do not match.", success: "" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: "" };
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
    return { error: "Invalid beta code.", success: "" };
  }

  if (!codeRow.is_active) {
    return { error: "This beta code is inactive.", success: "" };
  }

  if (codeRow.expires_at && new Date(codeRow.expires_at) <= new Date()) {
    return { error: "This beta code has expired.", success: "" };
  }

  if (codeRow.used_count >= codeRow.max_uses) {
    return { error: "This beta code has already been fully used.", success: "" };
  }

  const supabase = await createClient();

  let userId: string | null = null;
  let hasSession = false;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { error: error.message, success: "" };
    }

    userId = data.user?.id ?? null;
    hasSession = !!data.session;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unexpected signup error.",
      success: "",
    };
  }

  if (!userId) {
    return {
      error: "Account was created incorrectly. Please try again.",
      success: "",
    };
  }

  const { error: redemptionError } = await admin
    .from("beta_code_redemptions")
    .insert({
      code_id: codeRow.id,
      user_id: userId,
    });

  if (redemptionError) {
    return {
      error:
        "Account created, but beta code redemption failed. Please contact support.",
      success: "",
    };
  }

  const nextUsedCount = codeRow.used_count + 1;

  const { error: updateError } = await admin
    .from("beta_codes")
    .update({
      used_count: nextUsedCount,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", codeRow.id);

  if (updateError) {
    return {
      error: "Account created, but beta code usage could not be updated.",
      success: "",
    };
  }

  // Track the code only after redemption and usage count both succeed.
  // This event represents an actual consumed beta code, not an application.
  await trackServerEvent("beta_code_redeemed", userId, {
    beta_code: codeRow.code,
    beta_code_id: codeRow.id,
    signup_method: "email_password",
    used_count: nextUsedCount,
    max_uses: codeRow.max_uses,
  });

  const { error: acceptanceError } = await admin
    .from("user_policy_acceptances")
    .upsert(
      {
        user_id: userId,
        terms_version: POLICY_VERSION,
        privacy_version: POLICY_VERSION,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (acceptanceError) {
    return {
      error:
        "Account created, but policy acceptance could not be saved. Please contact support or try signing in again.",
      success: "",
    };
  }

  if (!hasSession) {
    return {
      error: "",
      success: "Account created, but no session was established.",
    };
  }

  redirect(next.startsWith("/") ? next : "/hub");
}
