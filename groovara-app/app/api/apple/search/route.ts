import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";

export const runtime = "nodejs"; // jose + crypto needs node runtime on Vercel

type AppleSearchResponse = {
  results?: {
    songs?: {
      data: Array<{
        id: string;
        attributes?: {
          name?: string;
          artistName?: string;
          albumName?: string;
          url?: string;
          artwork?: { url?: string; width?: number; height?: number };
        };
      }>;
    };
  };
};

async function getAppleDeveloperToken() {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKeyRaw = process.env.APPLE_MUSIC_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKeyRaw) {
    throw new Error("Missing Apple Music env vars (TEAM_ID, KEY_ID, PRIVATE_KEY).");
  }

  // Convert "\n" sequences back into real newlines
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  // Apple Music uses ES256
  const alg = "ES256";
  const pkcs8 = await importPKCS8(privateKey, alg);

  const now = Math.floor(Date.now() / 1000);
  // Apple allows long-lived tokens; keep it short-ish for safety (30 days)
  const exp = now + 60 * 60 * 24 * 30;

  return await new SignJWT({})
    .setProtectedHeader({ alg, kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(pkcs8);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ tracks: [] });

    const storefront = process.env.APPLE_MUSIC_STOREFRONT || "us";
    const token = await getAppleDeveloperToken();

    const url =
      `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}` +
      `/search?term=${encodeURIComponent(q)}&types=songs&limit=10`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // avoid caching weirdness during dev
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Apple search failed (${res.status})`, detail: text.slice(0, 300) },
        { status: 500 }
      );
    }

    const json = (await res.json()) as AppleSearchResponse;

    const tracks =
      json.results?.songs?.data?.map((s) => {
        const a = s.attributes ?? {};
        const artworkTemplate = a.artwork?.url ?? null;
        // Apple artwork URLs have {w}x{h} placeholders
        const image =
          artworkTemplate
            ? artworkTemplate.replace("{w}", "200").replace("{h}", "200")
            : null;

        return {
          id: s.id,
          title: a.name ?? "Unknown Title",
          artist: a.artistName ?? "Unknown Artist",
          album: a.albumName ?? "",
          url: a.url ?? "",
          image,
        };
      }) ?? [];

    return NextResponse.json({ tracks });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Apple route error" },
      { status: 500 }
    );
  }
}
