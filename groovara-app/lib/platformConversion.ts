export type Platform = "spotify" | "youtube" | "apple";

export type ConvertibleTrack = {
  title: string;
  artist: string;
  platform: Platform;
  track_id: string;
  url?: string;
  isrc?: string | null;
};

type ExplicitSearchAuthorization = {
  platform: Platform;
  pathname: string;
};

type ConvertResponse = {
  error?: string;
  code?: string;
  status?: string;
  manualSearchUrl?: string;
  track?: Partial<ConvertibleTrack>;
};

let explicitSearchAuthorization: ExplicitSearchAuthorization | null = null;

function isPlatform(value: string): value is Platform {
  return (
    value === "spotify" ||
    value === "youtube" ||
    value === "apple"
  );
}

function urlMatchesPlatform(
  rawUrl: string | null | undefined,
  platform: Platform,
) {
  if (!rawUrl) return false;

  try {
    const host = new URL(rawUrl).hostname.toLowerCase();

    if (platform === "youtube") {
      return (
        host === "youtu.be" ||
        host === "youtube.com" ||
        host.endsWith(".youtube.com") ||
        host === "youtube-nocookie.com" ||
        host.endsWith(".youtube-nocookie.com")
      );
    }

    if (platform === "spotify") {
      return host === "open.spotify.com";
    }

    return (
      host === "music.apple.com" ||
      host.endsWith(".music.apple.com") ||
      host === "itunes.apple.com"
    );
  } catch {
    return false;
  }
}

function buildManualYouTubeSearchUrl(title: string, artist: string) {
  const query = [artist, title].filter(Boolean).join(" ").trim();

  return (
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(query)
  );
}

function showYouTubeSearchFallback(
  title: string,
  artist: string,
  providedUrl?: string | null,
) {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(
    "groovara-youtube-search-fallback",
  );
  existing?.remove();

  const root = document.createElement("div");
  root.id = "groovara-youtube-search-fallback";
  root.setAttribute("role", "status");

  Object.assign(root.style, {
    position: "fixed",
    left: "50%",
    bottom: "1rem",
    transform: "translateX(-50%)",
    zIndex: "9999",
    width: "min(34rem, calc(100vw - 2rem))",
    border: "1px solid #5B4B6E",
    borderRadius: "1rem",
    background: "#F4EDDD",
    color: "#292923",
    padding: "1rem",
    boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
    fontFamily: "inherit",
  });

  const message = document.createElement("p");
  message.textContent =
    "YouTube search is temporarily unavailable. This song will keep playing on its original platform.";
  Object.assign(message.style, {
    margin: "0",
    fontSize: "0.875rem",
    lineHeight: "1.45",
  });

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "0.75rem",
  });

  const link = document.createElement("a");
  link.href =
    providedUrl ||
    buildManualYouTubeSearchUrl(title, artist);
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "SEARCH ON YOUTUBE";
  Object.assign(link.style, {
    color: "#5B4B6E",
    fontSize: "0.75rem",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  });

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "DISMISS";
  Object.assign(close.style, {
    marginLeft: "auto",
    border: "0",
    background: "transparent",
    color: "#5B4B6E",
    cursor: "pointer",
    fontSize: "0.7rem",
    fontWeight: "700",
    letterSpacing: "0.08em",
  });
  close.addEventListener("click", () => root.remove());

  actions.append(link, close);
  root.append(message, actions);
  document.body.append(root);
}

// A saved platform preference should never authorize a brand-new API search
// just because a Mixlist was opened or another song was revealed. Only a
// direct user change to the LISTEN ON selector authorizes fresh conversion
// searches for the current Mixlist path.
if (
  typeof document !== "undefined" &&
  typeof window !== "undefined"
) {
  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;

      if (!(target instanceof HTMLSelectElement)) return;
      if (
        target.getAttribute("aria-label") !==
        "Listen on platform"
      ) {
        return;
      }

      if (!isPlatform(target.value)) return;

      explicitSearchAuthorization = {
        platform: target.value,
        pathname: window.location.pathname,
      };
    },
    true,
  );
}

function freshSearchWasExplicitlyRequested(
  preferredPlatform: Platform,
) {
  if (typeof window === "undefined") return false;

  return (
    explicitSearchAuthorization?.platform === preferredPlatform &&
    explicitSearchAuthorization.pathname ===
      window.location.pathname
  );
}

export async function convertTrackPlatform(
  track: ConvertibleTrack,
  preferredPlatform: Platform,
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
        allowSearch:
          freshSearchWasExplicitlyRequested(
            preferredPlatform,
          ),
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | ConvertResponse
      | null;

    if (!response.ok) {
      if (
        preferredPlatform === "youtube" &&
        (data?.code ===
          "youtube_search_budget_exhausted" ||
          data?.code ===
            "youtube_search_quota_exhausted")
      ) {
        showYouTubeSearchFallback(
          track.title,
          track.artist,
          data.manualSearchUrl,
        );
      }

      return track;
    }

    const converted = data?.track;
    const convertedUrl =
      typeof converted?.url === "string"
        ? converted.url
        : null;

    if (
      !convertedUrl ||
      !urlMatchesPlatform(
        convertedUrl,
        preferredPlatform,
      )
    ) {
      // This also protects against legacy cached error rows that may claim a
      // target platform while falling back to the original source URL.
      return track;
    }

    return {
      title:
        typeof converted.title === "string"
          ? converted.title
          : track.title,
      artist:
        typeof converted.artist === "string"
          ? converted.artist
          : track.artist,
      platform: preferredPlatform,
      track_id:
        typeof converted.track_id === "string"
          ? converted.track_id
          : track.track_id,
      url: convertedUrl,
      isrc: track.isrc ?? null,
    };
  } catch (error) {
    console.error(
      "convertTrackPlatform failed",
      error,
    );
    return track;
  }
}
