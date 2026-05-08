"use server";

import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { RATE_LIMITS } from "@/lib/security/rateLimitConfig";
import { LIMITS } from "@/lib/validation/limits";
import { validateTextField } from "@/lib/validation/text";

type FeedbackState = {
  error: string;
  success: string;
};


export async function submitFeedbackAction(
  _prevState: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const message = String(formData.get("message") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const page = String(formData.get("page") || "").trim();

  const feedbackValidationError = validateTextField({
    value: message,
    label: "Feedback",
    min: 5,
    max: LIMITS.feedbackMessage,
  });

  if (feedbackValidationError) {
    return {
      error: feedbackValidationError,
      success: "",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "You must be logged in to submit feedback.",
      success: "",
    };
  }

  const rateLimit = await enforceRateLimit({
  action: "submit_feedback",
  ...RATE_LIMITS.submit_feedback,
  metadata: { 
    source: "app/feedback/actions.ts",
    page,
    category: category || null,
    },
  });

  if (!rateLimit.ok) {
    return {
      error: rateLimit.message,
      success: "",
    };
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    email: user.email ?? null,
    category: category || null,
    message,
    page: page || null,
  });

  if (error) {
    console.error("submit feedback error", error);
    return {
      error: "Couldn't submit feedback. Please try again.",
      success: "",
    };
  }

  return {
    error: "",
    success: "Feedback submitted. Thank you.",
  };
}