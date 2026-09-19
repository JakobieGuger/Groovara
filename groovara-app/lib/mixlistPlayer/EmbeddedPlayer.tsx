"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { extractYouTubeId } from "./youtube";
import { ensureAppleMusicAuthorizedInstance } from "@/lib/appleMusicClient";

type EmbeddedPlayerProps = {
  url: string | null;
  platform?: "youtube" | "spotify" | "apple" | "other";
  trackId?: string | null;
  isHidden: boolean;
  title?: string;
  artist?: string;
  autoplay?: boolean;
};

const MEDIA_ACTIVATE_EVENT = "groovara:media-activate";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isValidSpotifyTrackId(
  value: string | null | undefined,
): value is string {
  return !!value && /^[A-Za-z0-9]{22}$/.test(value);
}

function isNumericTrackId(
  value: string | null | undefined,
): value is string {
  return !!value && /^[0-9]+$/.test(value);
}

function extractSpotifyTrackId(rawUrl: string | null): string | null {
  if (!rawUrl) return null;

  if (rawUrl.startsWith("spotify:track:")) {
    const id = rawUrl.split(":")[2] ?? null;
    return isValidSpotifyTrackId(id) ? id : null;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (!host.includes("spotify.com")) return null;

    const segments = parsed.pathname.split("/").filter(Boolean);
    const trackIndex = segments.indexOf("track");

    if (trackIndex === -1) return null;

    const id = segments[trackIndex + 1] ?? null;
    return isValidSpotifyTrackId(id) ? id : null;
  } catch {
    return null;
  }
}

function extractAppleTrackId(
  rawUrl: string | null,
  trackId?: string | null,
): string | null {
  if (isNumericTrackId(trackId)) return trackId;
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);

    const queryId = parsed.searchParams.get("i");
    if (isNumericTrackId(queryId)) return queryId;

    const parts = parsed.pathname.split("/").filter(Boolean);
    const finalPart = parts.at(-1) ?? null;

    if (
      parsed.pathname.includes("/song/") &&
      isNumericTrackId(finalPart)
    ) {
      return finalPart;
    }

    return null;
  } catch {
    return null;
  }
}

function buildAppleEmbedUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;

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

/* -------------------------------------------------------------------------- */
/* Spotify IFrame API                                                         */
/* -------------------------------------------------------------------------- */

type SpotifyEmbedController = {
  loadEntity: (uriOrUrl: string) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  addListener: (
    event: string,
    listener: (event?: unknown) => void,
  ) => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: {
      uri: string;
      width?: string | number;
      height?: string | number;
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onAutoplayBlocked?: () => void;
      };
    },
  ) => YouTubePlayer;
};

type GroovaraWindow = Window & {
  onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  __groovaraSpotifyIframeApi?: SpotifyIframeApi;

  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null;

function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  const w = window as GroovaraWindow;

  if (w.__groovaraSpotifyIframeApi) {
    return Promise.resolve(w.__groovaraSpotifyIframeApi);
  }

  if (spotifyApiPromise) {
    return spotifyApiPromise;
  }

  spotifyApiPromise = new Promise((resolve, reject) => {
    const previousCallback = w.onSpotifyIframeApiReady;

    w.onSpotifyIframeApiReady = (api) => {
      w.__groovaraSpotifyIframeApi = api;

      if (previousCallback) {
        previousCallback(api);
      }

      resolve(api);
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[data-groovara-spotify-iframe-api="true"]',
    );

    if (!script) {
      script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.dataset.groovaraSpotifyIframeApi = "true";
      script.onerror = () => {
        spotifyApiPromise = null;
        reject(new Error("Spotify IFrame API failed to load"));
      };

      document.body.appendChild(script);
    }
  });

  return spotifyApiPromise;
}

function SpotifyPlayer({
  trackId,
  autoplay,
}: {
  trackId: string;
  autoplay: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const loadedUriRef = useRef<string | null>(null);
  const currentUriRef = useRef(`spotify:track:${trackId}`);
  const autoplayRef = useRef(autoplay);

  const [ready, setReady] = useState(false);

  const uri = `spotify:track:${trackId}`;

  useEffect(() => {
    currentUriRef.current = uri;
    autoplayRef.current = autoplay;
  }, [uri, autoplay]);

  useEffect(() => {
    let cancelled = false;

    const createPlayer = async () => {
      const element = mountRef.current;
      if (!element) return;

      try {
        const api = await loadSpotifyIframeApi();

        if (cancelled || !mountRef.current) return;

        api.createController(
          mountRef.current,
          {
            uri: currentUriRef.current,
            width: "100%",
            height: 152,
          },
          (controller) => {
            if (cancelled) {
              controller.destroy();
              return;
            }

            controllerRef.current = controller;
            loadedUriRef.current = currentUriRef.current;

            controller.addListener("ready", () => {
              setReady(true);

              if (autoplayRef.current) {
                try {
                  controller.play();
                } catch {}
              }
            });
          },
        );
      } catch (error) {
        console.error(
          "[Groovara] Spotify player failed to initialize",
          error,
        );
      }
    };

    void createPlayer();

    return () => {
      cancelled = true;

      try {
        controllerRef.current?.destroy();
      } catch {}

      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const controller = controllerRef.current;
    if (!controller) return;

    if (loadedUriRef.current !== uri) {
      try {
        controller.loadEntity(uri);
        loadedUriRef.current = uri;
      } catch (error) {
        console.error(
          "[Groovara] Spotify track switch failed",
          error,
        );
        return;
      }
    }

    if (autoplay) {
      try {
        controller.play();
      } catch (error) {
        console.info(
          "[Groovara] Spotify autoplay was blocked",
          error,
        );
      }
    }
  }, [uri, autoplay, ready]);

  /*
   * This event is fired directly from Groovara's REVEAL/NEXT click.
   * Keeping play() inside that call stack gives Safari the strongest
   * possible evidence that playback came from the listener.
   */
  useEffect(() => {
    const activate = () => {
      try {
        controllerRef.current?.play();
      } catch {}
    };

    window.addEventListener(MEDIA_ACTIVATE_EVENT, activate);

    return () => {
      window.removeEventListener(MEDIA_ACTIVATE_EVENT, activate);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-muted/80 p-3">
      <div className="relative h-[152px] w-full overflow-hidden rounded-xl border border-border bg-card/70 sm:h-[180px]">
        <div ref={mountRef} className="h-full w-full" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* YouTube IFrame API                                                         */
/* -------------------------------------------------------------------------- */

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  const w = window as GroovaraWindow;

  if (w.YT?.Player) {
    return Promise.resolve(w.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = w.onYouTubeIframeAPIReady;

    w.onYouTubeIframeAPIReady = () => {
      if (previousCallback) {
        previousCallback();
      }

      if (w.YT?.Player) {
        resolve(w.YT);
      } else {
        youtubeApiPromise = null;
        reject(new Error("YouTube IFrame API was not available"));
      }
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[data-groovara-youtube-iframe-api="true"]',
    );

    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.groovaraYoutubeIframeApi = "true";
      script.onerror = () => {
        youtubeApiPromise = null;
        reject(new Error("YouTube IFrame API failed to load"));
      };

      document.body.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function YouTubePlayer({
  videoId,
  autoplay,
}: {
  videoId: string;
  autoplay: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const currentVideoIdRef = useRef(videoId);
  const loadedVideoIdRef = useRef(videoId);
  const autoplayRef = useRef(autoplay);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    currentVideoIdRef.current = videoId;
    autoplayRef.current = autoplay;
  }, [videoId, autoplay]);

  useEffect(() => {
    let cancelled = false;

    const createPlayer = async () => {
      const element = mountRef.current;
      if (!element) return;

      try {
        const YT = await loadYouTubeIframeApi();

        if (cancelled || !mountRef.current) return;

        const player = new YT.Player(mountRef.current, {
          videoId: currentVideoIdRef.current,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;

              playerRef.current = player;
              loadedVideoIdRef.current =
                currentVideoIdRef.current;
              setReady(true);

              if (autoplayRef.current) {
                try {
                  player.playVideo();
                } catch {}
              }
            },

            onAutoplayBlocked: () => {
              console.info(
                "[Groovara] YouTube autoplay was blocked by the browser.",
              );
            },
          },
        });

        playerRef.current = player;
      } catch (error) {
        console.error(
          "[Groovara] YouTube player failed to initialize",
          error,
        );
      }
    };

    void createPlayer();

    return () => {
      cancelled = true;

      try {
        playerRef.current?.destroy();
      } catch {}

      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const player = playerRef.current;
    if (!player) return;

    if (loadedVideoIdRef.current !== videoId) {
      try {
        if (autoplay) {
          // YouTube documents loadVideoById() as loading + playing.
          player.loadVideoById(videoId);
        } else {
          player.cueVideoById(videoId);
        }

        loadedVideoIdRef.current = videoId;
      } catch (error) {
        console.error(
          "[Groovara] YouTube track switch failed",
          error,
        );
      }

      return;
    }

    if (autoplay) {
      try {
        player.playVideo();
      } catch {}
    }
  }, [videoId, autoplay, ready]);

  useEffect(() => {
    const activate = () => {
      try {
        playerRef.current?.playVideo();
      } catch {}
    };

    window.addEventListener(MEDIA_ACTIVATE_EVENT, activate);

    return () => {
      window.removeEventListener(MEDIA_ACTIVATE_EVENT, activate);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-muted/80 p-3">
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card/70 pt-[56.25%]">
        <div
          ref={mountRef}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Apple MusicKit                                                             */
/* -------------------------------------------------------------------------- */

function AppleMusicPlayer({
  appleTrackId,
  url,
  title,
  artist,
  autoplay,
}: {
  appleTrackId: string;
  url: string | null;
  title?: string;
  artist?: string;
  autoplay: boolean;
}) {
  const musicRef = useRef<Awaited<
    ReturnType<typeof ensureAppleMusicAuthorizedInstance>
  >["instance"] | null>(null);
  const currentIdRef = useRef(appleTrackId);
  const autoplayRef = useRef(autoplay);

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<
    "loading" | "ready" | "playing" | "error"
  >("loading");

  useEffect(() => {
    currentIdRef.current = appleTrackId;
    autoplayRef.current = autoplay;
  }, [appleTrackId, autoplay]);

  useEffect(() => {
    let cancelled = false;

    void ensureAppleMusicAuthorizedInstance()
      .then(({ instance }) => {
        if (cancelled) return;

        musicRef.current = instance;
        setReady(true);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;

        console.error(
          "[Groovara] MusicKit failed to initialize",
          error,
        );

        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const playCurrent = async () => {
    try {
      const { instance: music } =
        await ensureAppleMusicAuthorizedInstance();
    
      musicRef.current = music;
    
      await music.setQueue({
        song: currentIdRef.current,
        startPlaying: true,
      });
    
      await music.play();
    
      setStatus("playing");
    } catch (error) {
      console.error(
        "[Groovara] Apple Music playback failed",
        error,
      );
    
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!ready || !autoplay) return;

    let cancelled = false;

    const syncPlayback = async () => {
      try {
        const { instance: music } =
          await ensureAppleMusicAuthorizedInstance();

        if (cancelled) return;

        musicRef.current = music;

        await music.setQueue({
          song: appleTrackId,
          startPlaying: true,
        });

        if (cancelled) return;

        await music.play();
      } catch (error) {
        if (cancelled) return;

        console.error(
          "[Groovara] Apple Music autoplay failed",
          error,
        );
      }
    };

    void syncPlayback();

    return () => {
      cancelled = true;
    };
  }, [appleTrackId, autoplay, ready]);

  /*
   * This is the important mobile path: REVEAL/NEXT dispatches this
   * synchronously from its click handler.
   */
  useEffect(() => {
    const activate = () => {
      void playCurrent();
    };

    window.addEventListener(MEDIA_ACTIVATE_EVENT, activate);

    return () => {
      window.removeEventListener(MEDIA_ACTIVATE_EVENT, activate);
    };
  }, []);

  const pause = async () => {
    try {
      const { instance: music } =
        await ensureAppleMusicAuthorizedInstance();

      musicRef.current = music;

      await music.pause();
      setStatus("ready");
    } catch (error) {
      console.error(
        "[Groovara] Apple Music pause failed",
        error,
      );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/80 p-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
        APPLE MUSIC
      </p>

      <p className="gv-accent mt-2 truncate text-sm">
        {title || "Apple Music track"}
      </p>

      {artist ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {artist}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void playCurrent()}
          className="rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-xs tracking-wider gv-accent transition hover:bg-purple-500/20"
        >
          {status === "playing" ? "PLAYING" : "PLAY"}
        </button>

        <button
          type="button"
          onClick={() => void pause()}
          className="rounded-full border border-border bg-card/70 px-4 py-2 text-xs tracking-wider text-foreground transition hover:bg-card"
        >
          PAUSE
        </button>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border bg-card/70 px-4 py-2 text-xs tracking-wider text-foreground transition hover:bg-card"
          >
            OPEN
          </a>
        ) : null}
      </div>

      {status === "loading" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Preparing Apple Music…
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Apple Music could not start automatically. Tap PLAY to try again.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main player                                                                */
/* -------------------------------------------------------------------------- */

export default function EmbeddedPlayer({
  url,
  platform,
  trackId,
  isHidden,
  title,
  artist,
  autoplay = false,
}: EmbeddedPlayerProps) {
  let player: ReactNode = null;

  if (platform === "spotify") {
    const spotifyTrackId = isValidSpotifyTrackId(trackId)
      ? trackId
      : extractSpotifyTrackId(url);

    if (spotifyTrackId) {
      player = (
        <SpotifyPlayer
          trackId={spotifyTrackId}
          autoplay={autoplay}
        />
      );
    }
  }

  if (platform === "apple") {
    const appleTrackId = extractAppleTrackId(url, trackId);

    if (appleTrackId) {
      player = (
        <AppleMusicPlayer
          appleTrackId={appleTrackId}
          url={url}
          title={title}
          artist={artist}
          autoplay={autoplay}
        />
      );
    } else {
      // Keep the existing Apple embed as a fallback if we somehow have
      // an Apple URL but no usable catalog song ID.
      const appleEmbedUrl = buildAppleEmbedUrl(url);

      if (appleEmbedUrl) {
        player = (
          <div className="rounded-2xl border border-border bg-muted/80 p-3">
            <div className="relative h-[152px] w-full overflow-hidden rounded-xl border border-border bg-card/70 sm:h-[180px]">
              <iframe
                src={appleEmbedUrl}
                title={
                  [title, artist].filter(Boolean).join(" - ") ||
                  "Apple Music player"
                }
                className="h-full w-full"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        );
      }
    }
  }

  if (platform === "youtube" || (!platform && url)) {
    const youtubeId = url ? extractYouTubeId(url) : null;

    if (youtubeId) {
      player = (
        <YouTubePlayer
          videoId={youtubeId}
          autoplay={autoplay}
        />
      );
    }
  }

  if (!player && url) {
    player = (
      <div className="rounded-2xl border border-border bg-muted/80 p-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-xl border border-border bg-card/70 px-4 py-2 text-sm text-foreground transition hover:bg-card"
        >
          Open on platform
        </a>

        {isYouTubeUrl(url) ? (
          <p className="mt-2 text-xs text-muted-foreground">
            This YouTube link cannot be embedded.
          </p>
        ) : null}
      </div>
    );
  }

  if (!player) {
    player = (
      <div className="rounded-2xl border border-border bg-muted/80 p-4 text-sm text-muted-foreground">
        No playable song URL available.
      </div>
    );
  }

  /*
   * Do NOT unmount the real media player while a song is hidden.
   * visibility:hidden keeps its layout/player instance alive without
   * exposing the hidden song.
   */
  return (
    <div className="relative">
      <div
        className={isHidden ? "invisible" : ""}
        aria-hidden={isHidden ? true : undefined}
      >
        {player}
      </div>

      {isHidden ? (
        <div className="absolute inset-0 flex items-center rounded-2xl border border-border bg-muted/80 p-4 text-sm text-muted-foreground">
          Reveal this song to play it.
        </div>
      ) : null}
    </div>
  );
}