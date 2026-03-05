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
      className="text-sm text-red-200 hover:text-red-600 dark:hover:text-red-400 transition"
    >
      Log out
    </button>
  );
}
