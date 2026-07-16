export type Platform = "spotify" | "youtube" | "apple";

export type ConvertibleTrack = {
  title: string;
  artist: string;
  platform: Platform;
  track_id: string;
  url?: string;
  isrc?: string | null;
};

export async function convertTrackPlatform(
  track: ConvertibleTrack,
  preferredPlatform: Platform
): Promise<ConvertibleTrack> {
  if (track.platform === preferredPlatform) {
    return track;
  }

  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourcePlatform: track.platform,
        sourceUrl: track.url ?? "",
        sourceTitle: track.title,
        sourceArtist: track.artist,
        sourceIsrc: track.isrc ?? null,
        targetPlatform: preferredPlatform,
      }),
    });

    if (!response.ok) {
      return track;
    }

    const data = await response.json();
    const converted = data?.track;

    if (!converted?.url) {
      return track;
    }

    return {
      title: converted.title ?? track.title,
      artist: converted.artist ?? track.artist,
      platform: converted.platform ?? preferredPlatform,
      track_id: converted.track_id ?? track.track_id,
      url: converted.url ?? track.url,
    };
  } catch (error) {
    console.error("convertTrackPlatform failed", error);
    return track;
  }
}