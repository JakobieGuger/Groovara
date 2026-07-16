export function normalizeIsrc(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return /^[A-Z0-9]{12}$/.test(normalized) ? normalized : null;
}

function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(featuring|feat\.?|ft\.?)\b/gi, " feat ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTitleArtistIdentity(
  title: string,
  artist: string,
): string {
  const normalizedTitle = normalizeIdentityText(title);
  const normalizedArtist = normalizeIdentityText(artist);

  return `${normalizedArtist}::${normalizedTitle}`;
}
