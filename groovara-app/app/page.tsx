import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params?.code || "";

  if (code) {
    redirect(`/beta?code=${encodeURIComponent(code)}`);
  }

  redirect("/beta");
}