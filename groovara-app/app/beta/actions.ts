"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateBetaCode } from "@/lib/beta/codegen";
import {ALLOWED_BETA_CODE_EMAILS} from "@/lib/beta/allowedEmails";

type CreateCodeResult = {
  error: string;
  success: string;
  code: string;
};

export async function createBetaCodeAction(
  _prevState: CreateCodeResult
): Promise<CreateCodeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalizedEmail = user?.email?.trim().toLowerCase() || "";

  if (!user || !normalizedEmail || !ALLOWED_BETA_CODE_EMAILS.includes(normalizedEmail)) {
    return {
      error: "Unauthorized.",
      success: "",
      code: "",
    };
  }

  const admin = createAdminClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateBetaCode();

    const { error } = await admin.from("beta_codes").insert({
      code,
      is_active: true,
      max_uses: 1,
      used_count: 0,
    });

    if (!error) {
      return {
        error: "",
        success: "Beta code created successfully.",
        code,
      };
    }

    if (attempt === 4) {
      return {
        error: "Failed to create beta code.",
        success: "",
        code: "",
      };
    }
  }

  return {
    error: "Failed to create beta code.",
    success: "",
    code: "",
  };
}