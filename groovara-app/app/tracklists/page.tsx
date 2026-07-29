import { redirect } from "next/navigation";

export default async function LegacyStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;

  if (params.tab === "sent" || params.tab === "received") {
    redirect(`/hub?tab=${params.tab}`);
  }

  redirect("/hub");
}
