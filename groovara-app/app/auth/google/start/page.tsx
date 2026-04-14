import GoogleStart from "./GoogleStart";

export default async function GoogleStartPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return <GoogleStart next={params?.next || "/hub"} />;
}