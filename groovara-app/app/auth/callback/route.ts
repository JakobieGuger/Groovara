import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerEvent } from "@/lib/analyticsServer";

const GOOGLE_BETA_COOKIE = "groovara_google_beta_code";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/hub";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback exchange failed:", error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", url.origin));
  }

  const admin = createAdminClient();

  // If user already has a redemption, they're allowed in.
  const { data: existingRedemption } = await admin
    .from("beta_code_redemptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingRedemption) {
    response.cookies.delete(GOOGLE_BETA_COOKIE);
    return response;
  }

  // Otherwise they must have just passed the beta-code gate.
  const betaCode = request.cookies.get(GOOGLE_BETA_COOKIE)?.value ?? null;

  if (!betaCode) {
    await supabase.auth.signOut();
    const denied = NextResponse.redirect(
      new URL("/beta?error=beta_required", url.origin)
    );
    denied.cookies.delete(GOOGLE_BETA_COOKIE);
    return denied;
  }

  const { data: codeRow, error: codeError } = await admin
    .from("beta_codes")
    .select("id, code, is_active, max_uses, used_count, expires_at")
    .eq("code", betaCode)
    .maybeSingle();

  if (
    codeError ||
    !codeRow ||
    !codeRow.is_active ||
    (codeRow.expires_at && new Date(codeRow.expires_at) <= new Date()) ||
    codeRow.used_count >= codeRow.max_uses
  ) {
    await supabase.auth.signOut();
    const denied = NextResponse.redirect(
      new URL("/beta?error=invalid_beta_code", url.origin)
    );
    denied.cookies.delete(GOOGLE_BETA_COOKIE);
    return denied;
  }

  const { error: redemptionError } = await admin
    .from("beta_code_redemptions")
    .insert({
      code_id: codeRow.id,
      user_id: user.id,
    });

  if (redemptionError) {
    console.error("Google OAuth beta redemption failed:", redemptionError);
    await supabase.auth.signOut();
    const denied = NextResponse.redirect(
      new URL("/beta?error=redemption_failed", url.origin)
    );
    denied.cookies.delete(GOOGLE_BETA_COOKIE);
    return denied;
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
    console.error("Google OAuth beta usage update failed:", updateError);
    await supabase.auth.signOut();
    const denied = NextResponse.redirect(
      new URL("/beta?error=usage_update_failed", url.origin)
    );
    denied.cookies.delete(GOOGLE_BETA_COOKIE);
    return denied;
  }

  // Track only successful, newly-consumed beta codes.
  await trackServerEvent("beta_code_redeemed", user.id, {
    beta_code: codeRow.code,
    beta_code_id: codeRow.id,
    signup_method: "google",
    used_count: nextUsedCount,
    max_uses: codeRow.max_uses,
  });

  response.cookies.delete(GOOGLE_BETA_COOKIE);
  return response;
}
