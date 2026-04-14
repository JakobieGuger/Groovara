import EnterBetaGoogleForm from "./EnterBetaGoogleForm";

export default async function EnterBetaGooglePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; code?: string }>;
}) {
  const params = await searchParams;

  return (
    <EnterBetaGoogleForm
      next={params?.next || "/hub"}
      codeFromUrl={params?.code || ""}
    />
  );
}