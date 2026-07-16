import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login | Groovara",
  description:
    "Sign in to Groovara to create Tracklists and share Mixlists.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; code?: string }>;
}) {
  const params = await searchParams;

  return (
    <LoginForm
      next={params?.next || "/hub"}
      codeFromUrl={params?.code || ""}
    />
  );
}
