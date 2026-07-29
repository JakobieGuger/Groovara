import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FeedbackForm from "./FeedbackForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feedback | Groovara",
  description:
    "Share feedback, report a bug, or suggest an improvement for Groovara.",
};

export default async function FeedbackPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/feedback");
  }

  return (
    <Suspense fallback={null}>
      <FeedbackForm />
    </Suspense>
  );
}