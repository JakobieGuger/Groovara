import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BetaCodesClient from "./BetaCodesClient";
import {ALLOWED_BETA_CODE_EMAILS} from "@/lib/beta/allowedEmails";

export default async function BetaCodesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  const normalizedEmail = user.email.trim().toLowerCase();

  if (!ALLOWED_BETA_CODE_EMAILS.includes(normalizedEmail)) {
    redirect("/beta");
  }

  return <BetaCodesClient />;
}