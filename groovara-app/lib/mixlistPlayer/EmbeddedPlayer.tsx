"use client";

import { extractYouTubeId } from "./youtube";

type EmbeddedPlayerProps = {
  url: string | null;
  platform?: "youtube" | "spotify" | "apple" | "other";
  trackId?: string | null;
  isHidden: boolean;
  title?: string;
  artist?: string;
  autoplay?: boolean;
};

function isValidSpotifyTrackId(value: string | null | undefined): value is string {
  return !!value && /^[A-Za-z0-9]{22}$/.test(value);
}

function isNumericTrackId(value: string | null | undefined): value is string {
  return !!value && /^[0-9]+$/.test(value);
}

function isYouTubeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "www.youtu.be"
    );
  } catch {
    return false;
  }
}

function extractSpotifyTrackId(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith("spotify:track:")) {
    const id = rawUrl.split(":")[2] ?? null;
    return isValidSpotifyTrackId(id) ? id : null;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("spotify.com")) {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const trackIndex = segments.indexOf("track");
    if (trackIndex === -1) {
      return null;
    }

    const id = segments[trackIndex + 1] ?? null;
    return isValidSpotifyTrackId(id) ? id : null;
  } catch {
    return null;
  }
}

function buildAppleEmbedUrl(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (host === "embed.music.apple.com") {
      return parsed.toString();
    }

    if (!host.includes("music.apple.com")) {
      return null;
    }

    parsed.hostname = "embed.music.apple.com";
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function EmbeddedPlayer({
  url,
  platform,
  trackId,
  isHidden,
  title,
  artist,
  autoplay = false,
}: EmbeddedPlayerProps) {
  if (isHidden) {
    return (
      <div className="rounded-2xl border border-border bg-muted/80 p-4 text-sm text-muted-foreground">
        Reveal this song to play it.
      </div>
    );
  }

  if (platform === "spotify") {
    const spotifyTrackId = isValidSpotifyTrackId(trackId)
      ? trackId
      : extractSpotifyTrackId(url);

    if (spotifyTrackId) {
      const embedTitle = [title, artist].filter(Boolean).join(" - ") || "Spotify player";
      const src = `https://open.spotify.com/embed/track/${spotifyTrackId}${autoplay ? "?utm_source=generator" : ""}`;

      return (
        <div className="rounded-2xl border border-border bg-muted/80 p-3">
          <div className="relative h-[152px] w-full overflow-hidden rounded-xl border border-border bg-card/70 sm:h-[180px]">
            <iframe
              src={src}
              title={embedTitle}
              className="h-full w-full"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-border bg-muted/80 p-4">
        <p className="text-sm text-muted-foreground">Spotify track unavailable for embed.</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Open on Spotify
          </a>
        ) : null}
      </div>
    );
  }

  if (platform === "apple") {
    const appleEmbedUrl = buildAppleEmbedUrl(url);

    if (appleEmbedUrl) {
      const appleLabel = [title, artist].filter(Boolean).join(" - ");
      const embedTitle = appleLabel ? `${appleLabel} | Apple Music` : "Apple Music player";

      return (
        <div className="rounded-2xl border border-border bg-muted/80 p-3">
          <div className="relative h-[152px] w-full overflow-hidden rounded-xl border border-border bg-card/70 sm:h-[180px]">
            <iframe
              src={appleEmbedUrl}
              title={embedTitle}
              className="h-full w-full"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    const appleFallbackUrl = url
      ? url
      : isNumericTrackId(trackId)
        ? `https://music.apple.com/us/song/${trackId}`
        : null;

    return (
      <div className="rounded-2xl border border-border bg-muted/80 p-4">
        <p className="text-sm text-muted-foreground">Apple Music track unavailable for embed.</p>
        {appleFallbackUrl ? (
          <a
            href={appleFallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Open on Apple Music
          </a>
        ) : null}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="rounded-2xl border border-border bg-muted/80 p-4 text-sm text-muted-foreground">
        No song URL available.
      </div>
    );
  }

  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    const embedTitle = [title, artist].filter(Boolean).join(" - ") || "YouTube player";
    const src = `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? 1 : 0}&rel=0&playsinline=1`;

    return (
      <div className="rounded-2xl border border-border bg-muted/80 p-3">
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card/70 pt-[56.25%]">
          <iframe
            src={src}
            title={embedTitle}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  const handleOpen = () => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Intentionally swallow malformed URL errors.
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/80 p-4">
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        Open on platform
      </button>
      {isYouTubeUrl(url) && (
        <p className="mt-2 text-xs text-muted-foreground">This YouTube link cannot be embedded.</p>
      )}
    </div>
  );
}
