export function extractYouTubeId(url: string): string | null {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  const isValidId = (value: string | null): value is string =>
    !!value && /^[A-Za-z0-9_-]{11}$/.test(value);

  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = path.replace(/^\/+/, "").split("/")[0] ?? null;
    return isValidId(id) ? id : null;
  }

  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com"
  ) {
    if (path === "/watch") {
      const id = parsed.searchParams.get("v");
      return isValidId(id) ? id : null;
    }

    if (path.startsWith("/embed/")) {
      const id = path.split("/")[2] ?? null;
      return isValidId(id) ? id : null;
    }
  }

  return null;
}
