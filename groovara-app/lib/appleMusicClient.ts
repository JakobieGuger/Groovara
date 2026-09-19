"use client";

type AppleMusicInstance = {
  authorize: () => Promise<unknown>;
  unauthorize: () => Promise<unknown>;
  musicUserToken?: string;
  isAuthorized?: boolean;
  storefrontId?: string;

  setQueue: (options: {
    song: string;
    startPlaying?: boolean;
  }) => Promise<unknown>;

  play: () => Promise<unknown>;
  pause: () => Promise<unknown> | void;
};

type AppleMusicNamespace = {
  configure: (options: {
    developerToken: string;
    app: {
      name: string;
      build: string;
    };
  }) => unknown;
  getInstance: () => AppleMusicInstance;
};

declare global {
  interface Window {
    MusicKit?: AppleMusicNamespace;
  }
}

const MUSICKIT_SCRIPT =
  "https://js-cdn.music.apple.com/musickit/v3/musickit.js";

let scriptPromise: Promise<AppleMusicNamespace> | null = null;
let instancePromise: Promise<AppleMusicInstance> | null = null;

function waitForMusicKit(timeoutMs = 10_000) {
  return new Promise<AppleMusicNamespace>((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.MusicKit) {
        resolve(window.MusicKit);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Apple MusicKit did not finish loading."));
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

async function loadMusicKit() {
  if (typeof window === "undefined") {
    throw new Error("Apple Music authorization requires a browser.");
  }

  if (window.MusicKit) {
    return window.MusicKit;
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<AppleMusicNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${MUSICKIT_SCRIPT}"]`,
    );

    const finish = () => {
      void waitForMusicKit().then(resolve).catch(reject);
    };

    if (existing) {
      finish();
      return;
    }

    const script = document.createElement("script");
    script.src = MUSICKIT_SCRIPT;
    script.async = true;
    script.dataset.groovaraMusickit = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Apple MusicKit could not be loaded.")),
      { once: true },
    );

    document.head.appendChild(script);
  });

  try {
    return await scriptPromise;
  } catch (error) {
    scriptPromise = null;
    throw error;
  }
}

async function getConfiguredMusicKit() {
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    const [MusicKit, tokenResponse] = await Promise.all([
      loadMusicKit(),
      fetch("/api/apple/developer-token", {
        method: "GET",
        cache: "no-store",
      }),
    ]);

    const tokenData = (await tokenResponse
      .json()
      .catch(() => null)) as {
      developerToken?: string;
      error?: string;
    } | null;

    if (!tokenResponse.ok || !tokenData?.developerToken) {
      throw new Error(
        tokenData?.error ??
          "Groovara could not prepare Apple Music authorization.",
      );
    }

    await Promise.resolve(
      MusicKit.configure({
        developerToken: tokenData.developerToken,
        app: {
          name: "Groovara",
          build: process.env.NEXT_PUBLIC_APP_VERSION ?? "beta",
        },
      }),
    );

    return MusicKit.getInstance();
  })();

  try {
    return await instancePromise;
  } catch (error) {
    instancePromise = null;
    throw error;
  }
}

function readMusicUserToken(
  instance: AppleMusicInstance,
  authorizationResult?: unknown,
) {
  if (
    typeof authorizationResult === "string" &&
    authorizationResult.trim()
  ) {
    return authorizationResult.trim();
  }

  if (
    typeof instance.musicUserToken === "string" &&
    instance.musicUserToken.trim()
  ) {
    return instance.musicUserToken.trim();
  }

  return null;
}

export async function getAppleMusicAuthorizationState() {
  const instance = await getConfiguredMusicKit();
  const token = readMusicUserToken(instance);

  return {
    connected: Boolean(token || instance.isAuthorized),
    storefrontId:
      typeof instance.storefrontId === "string"
        ? instance.storefrontId
        : null,
  };
}

export async function ensureAppleMusicAuthorizedInstance() {
  const instance = await getConfiguredMusicKit();

  let token = readMusicUserToken(instance);

  if (!token) {
    const result = await instance.authorize();
    token = readMusicUserToken(instance, result);
  }

  if (!token) {
    throw new Error(
      "Apple Music authorized the session but did not provide a usable Music User Token.",
    );
  }

  return {
    instance,
    musicUserToken: token,
  };
}

export async function ensureAppleMusicAuthorized() {
  const { musicUserToken } =
    await ensureAppleMusicAuthorizedInstance();

  return musicUserToken;
}

export async function disconnectAppleMusic() {
  const instance = await getConfiguredMusicKit();
  await Promise.resolve(instance.unauthorize());
}
