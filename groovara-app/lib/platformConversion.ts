export type Platform = "spotify" | "youtube" | "apple";

export type ConvertibleTrack = {
  title: string;
  artist: string;
  platform: Platform;
  track_id: string;
  url?: string;
};

function getSearchEndpoint(platform: Platform, query: string) {
  const encoded = encodeURIComponent(query);

  switch (platform) {
    case "spotify":
      return `/api/spotify/search?q=${encoded}`;
    case "youtube":
      return `/api/youtube/search?q=${encoded}`;
    case "apple":
      return `/api/apple/search?q=${encoded}`;
    default:
      return "";
  }
}

function normalizeSearchText(value: string) {
  return value
    .replace(/\(.*?official.*?\)/gi, "")
    .replace(/\(.*?audio.*?\)/gi, "")
    .replace(/\bofficial video\b/gi, "")
    .replace(/\baudio\b/gi, "")
    .replace(/\bvevo\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function convertTrackPlatform(
  track: ConvertibleTrack,
  preferredPlatform: Platform
): Promise<ConvertibleTrack> {
  if (track.platform === preferredPlatform) {
    return track;
  }

  const query = `${normalizeSearchText(track.title)} ${normalizeSearchText(track.artist)}`;
  const endpoint = getSearchEndpoint(preferredPlatform, query);

  if (!endpoint) return track;

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      return track;
    }

    const data = await response.json();

    const match =
      data?.tracks?.[0] ??
      data?.results?.[0] ??
      data?.items?.[0] ??
      null;

    if (!match) {
      return track;
    }

    return {
      title: match.title ?? track.title,
      artist: match.artist ?? track.artist,
      platform: preferredPlatform,
      track_id: match.track_id ?? match.id ?? track.track_id,
      url: match.url ?? track.url,
    };
  } catch (error) {
    console.error("convertTrackPlatform failed", error);
    return track;
  }
}