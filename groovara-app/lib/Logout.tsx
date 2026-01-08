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
      className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-white/10 rounded-md"
    >
      Log out
    </button>
  );
}
