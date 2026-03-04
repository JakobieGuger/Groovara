"use client";

import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Failed to log out. Please try again.");
      return;
    }

    // Kick them back to landing page
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-md px-4 py-2 text-left text-sm text-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      Log out
    </button>
  );
}
