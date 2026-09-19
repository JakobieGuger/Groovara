import "server-only";

import { SignJWT, importPKCS8 } from "jose";

const MAX_APPLE_TOKEN_LIFETIME_SECONDS = 15_777_000;

function normalizePrivateKey(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

export async function getAppleDeveloperToken(options?: {
  origin?: string | null;
  ttlSeconds?: number;
}) {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID?.trim();
  const keyId = process.env.APPLE_MUSIC_KEY_ID?.trim();
  const privateKeyRaw = process.env.APPLE_MUSIC_PRIVATE_KEY?.trim();

  // Prefer generating a fresh token when signing credentials are available.
  // This lets web-facing tokens use Apple's recommended origin restriction.
  if (teamId && keyId && privateKeyRaw) {
    const ttlSeconds = Math.min(
      Math.max(options?.ttlSeconds ?? 60 * 60 * 24 * 30, 300),
      MAX_APPLE_TOKEN_LIFETIME_SECONDS,
    );

    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {};

    if (options?.origin) {
      payload.origin = [options.origin];
    }

    const privateKey = await importPKCS8(
      normalizePrivateKey(privateKeyRaw),
      "ES256",
    );

    return new SignJWT(payload)
      .setProtectedHeader({
        alg: "ES256",
        kid: keyId,
      })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .sign(privateKey);
  }

  // Keep compatibility with Groovara deployments that supply a pre-generated
  // token instead of the signing credentials.
  const configuredToken =
    process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim();

  if (configuredToken) {
    return configuredToken;
  }

  throw new Error(
    "Missing Apple Music credentials. Set APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, and APPLE_MUSIC_PRIVATE_KEY, or APPLE_MUSIC_DEVELOPER_TOKEN.",
  );
}
