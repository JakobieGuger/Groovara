import { NextResponse } from "next/server";
import { createSign } from "crypto";

export const runtime = "nodejs";

const APPLE_API_BASE = "https://api.music.apple.com";
const MAX_IMPORT_TRACKS = 300;

type AppleResource<TAttributes = Record<string, unknown>> = {
  id?: string;
  type?: string;
  href?: string;
  attributes?: TAttributes;
  relationships?: Record<
    string,
    {
      href?: string;
      next?: string;
      data?: AppleResource[];
    }
  >;
};

type ApplePlaylistAttributes = {
  name?: string;
  description?: {
    standard?: string;
    short?: string;
  };
  url?: string;
};

type AppleTrackAttributes = {
  name?: string;
  artistName?: string;
  albumName?: string;
  url?: string;
  artwork?: {
    url?: string;
  };
  durationInMillis?: number;
};

type AppleApiResponse<T = unknown> = {
  data?: T[];
  next?: string;
  errors?: Array<{ title?: string; detail?: string; code?: string }>;
};

type ImportedAppleTrack = {
  platform: "apple";
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  url: string;
  artwork_url: string | null;
  duration_ms: number | null;
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readDerLength(buffer: Buffer, offset: number) {
  let length = buffer[offset];
  offset += 1;

  if (length < 0x80) {
    return { length, offset };
  }

  const byteCount = length & 0x7f;
  length = 0;

  for (let i = 0; i < byteCount; i += 1) {
    length = (length << 8) + buffer[offset + i];
  }

  return { length, offset: offset + byteCount };
}

function readDerInteger(buffer: Buffer, offset: number) {
  if (buffer[offset] !== 0x02) {
    throw new Error("Invalid ECDSA signature.");
  }

  const lengthInfo = readDerLength(buffer, offset + 1);
  const value = buffer.subarray(
    lengthInfo.offset,
    lengthInfo.offset + lengthInfo.length,
  );

  return {
    value,
    offset: lengthInfo.offset + lengthInfo.length,
  };
}

function derToJoseSignature(signature: Buffer) {
  if (signature[0] !== 0x30) {
    throw new Error("Invalid ECDSA signature.");
  }

  const sequence = readDerLength(signature, 1);
  let offset = sequence.offset;

  const r = readDerInteger(signature, offset);
  offset = r.offset;

  const s = readDerInteger(signature, offset);

  const normalize = (value: Buffer) => {
    let normalized = value;
    while (normalized.length > 32 && normalized[0] === 0) {
      normalized = normalized.subarray(1);
    }

    if (normalized.length > 32) {
      throw new Error("Invalid ECDSA signature length.");
    }

    if (normalized.length === 32) return normalized;

    return Buffer.concat([Buffer.alloc(32 - normalized.length), normalized]);
  };

  return Buffer.concat([normalize(r.value), normalize(s.value)]);
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

function createAppleDeveloperToken() {
  const existingToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim();
  if (existingToken) return existingToken;

  const teamId = process.env.APPLE_MUSIC_TEAM_ID?.trim();
  const keyId = process.env.APPLE_MUSIC_KEY_ID?.trim();
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY?.trim();

  if (!teamId || !keyId || !privateKey) {
    throw new Error(
      "Missing Apple Music credentials. Set APPLE_MUSIC_DEVELOPER_TOKEN, or set APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, and APPLE_MUSIC_PRIVATE_KEY.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = 60 * 60 * 24 * 150;

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;

  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();

  const derSignature = signer.sign(normalizePrivateKey(privateKey));
  const joseSignature = derToJoseSignature(derSignature);

  return `${signingInput}.${base64Url(joseSignature)}`;
}

function parseApplePlaylistUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Paste a valid Apple Music playlist URL.");
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "music.apple.com" && !host.endsWith(".music.apple.com")) {
    throw new Error("Paste an Apple Music playlist URL from music.apple.com.");
  }

  const segments = parsed.pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment.trim()))
    .filter(Boolean);

  const storefrontFromPath = segments[0]?.toLowerCase();
  const storefront = storefrontFromPath && /^[a-z]{2}$/.test(storefrontFromPath)
    ? storefrontFromPath
    : process.env.APPLE_MUSIC_DEFAULT_STOREFRONT?.trim().toLowerCase() || "us";

  const playlistId = [...segments].reverse().find((segment) =>
    segment.startsWith("pl."),
  );

  if (!playlistId) {
    throw new Error(
      "Could not find the Apple Music playlist ID. Make sure the link points to a public playlist.",
    );
  }

  return {
    storefront,
    playlistId,
  };
}

function apiUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return `${APPLE_API_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function firstAppleError(json: AppleApiResponse<unknown>) {
  const first = json.errors?.[0];
  return first?.detail ?? first?.title ?? "Apple Music request failed.";
}

async function fetchApple<T = AppleResource>(url: string, developerToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as AppleApiResponse<T>;

  if (!response.ok) {
    throw new Error(firstAppleError(json));
  }

  return json;
}

function artworkUrl(template: string | undefined) {
  if (!template) return null;
  return template.replace("{w}", "600").replace("{h}", "600");
}

function normalizeTrack(resource: AppleResource<AppleTrackAttributes>): ImportedAppleTrack | null {
  if (!resource.id) return null;
  if (resource.type && !["songs", "music-videos"].includes(resource.type)) {
    return null;
  }

  const attributes = resource.attributes ?? {};
  const title = attributes.name?.trim();

  if (!title) return null;

  return {
    platform: "apple",
    track_id: resource.id,
    title,
    artist: attributes.artistName?.trim() || "Unknown Artist",
    album: attributes.albumName?.trim() || null,
    url: attributes.url ?? `https://music.apple.com/song/${resource.id}`,
    artwork_url: artworkUrl(attributes.artwork?.url),
    duration_ms:
      typeof attributes.durationInMillis === "number"
        ? attributes.durationInMillis
        : null,
  };
}

async function fetchAllPlaylistTracks(
  playlist: AppleResource<ApplePlaylistAttributes>,
  developerToken: string,
) {
  const relationship = playlist.relationships?.tracks;
  const tracks: AppleResource<AppleTrackAttributes>[] = [];

  if (Array.isArray(relationship?.data)) {
    tracks.push(...(relationship.data as AppleResource<AppleTrackAttributes>[]));
  }

  let next = relationship?.next;

  if (!next && tracks.length === 0 && relationship?.href) {
    next = relationship.href;
  }

  while (next && tracks.length < MAX_IMPORT_TRACKS) {
    const json = await fetchApple<AppleResource<AppleTrackAttributes>>(
      apiUrl(next),
      developerToken,
    );

    if (Array.isArray(json.data)) {
      tracks.push(...json.data);
    }

    next = json.next;
  }

  return {
    tracks: tracks
      .slice(0, MAX_IMPORT_TRACKS)
      .map(normalizeTrack)
      .filter((track): track is ImportedAppleTrack => Boolean(track)),
    truncated: Boolean(next) || tracks.length > MAX_IMPORT_TRACKS,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      url?: unknown;
    } | null;

    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json(
        { error: "Paste an Apple Music playlist URL." },
        { status: 400 },
      );
    }

    const { storefront, playlistId } = parseApplePlaylistUrl(rawUrl);
    const developerToken = createAppleDeveloperToken();
    const playlistEndpoint = `${APPLE_API_BASE}/v1/catalog/${encodeURIComponent(
      storefront,
    )}/playlists/${encodeURIComponent(playlistId)}?include=tracks`;

    const playlistJson = await fetchApple<AppleResource<ApplePlaylistAttributes>>(
      playlistEndpoint,
      developerToken,
    );

    const playlist = playlistJson.data?.[0];

    if (!playlist) {
      return NextResponse.json(
        { error: "Apple Music playlist not found. Make sure it is public." },
        { status: 404 },
      );
    }

    const { tracks, truncated } = await fetchAllPlaylistTracks(
      playlist,
      developerToken,
    );

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          error:
            "No tracks found. Make sure the Apple Music playlist is public and available in this storefront.",
        },
        { status: 404 },
      );
    }

    const attributes = playlist.attributes ?? {};

    return NextResponse.json({
      playlist: {
        id: playlist.id ?? playlistId,
        name: attributes.name?.trim() || "Apple Music Playlist",
        description:
          attributes.description?.standard?.trim() ||
          attributes.description?.short?.trim() ||
          null,
        url: attributes.url ?? rawUrl,
        platform: "apple",
        storefront,
      },
      tracks,
      truncated,
    });
  } catch (error: unknown) {
    console.error("Apple Music import failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Apple Music import failed.",
      },
      { status: 500 },
    );
  }
}