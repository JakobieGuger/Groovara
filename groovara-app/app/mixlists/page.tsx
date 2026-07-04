import { redirect } from "next/navigation";

export default function MixlistsRedirectPage() {
  redirect("/tracklists?tab=sent");
}