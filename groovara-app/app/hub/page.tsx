import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudioHubClient from "./StudioHubClient";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/hub");
  }

  return <StudioHubClient />;
}
