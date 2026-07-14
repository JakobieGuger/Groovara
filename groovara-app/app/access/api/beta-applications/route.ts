import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedDecades = new Set([
  "Under 18",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55–64",
  "65+",
]);

const allowedHistory = new Set([
  "Streaming playlists",
  "CDs or vinyl",
  "Downloaded music files",
  "Mixtapes or mix CDs",
  "I mostly listen without organizing",
]);

const allowedGoals = new Set([
  "Share music more thoughtfully",
  "Build gifts or listening experiences",
  "Keep music memories in one place",
  "Organize songs across platforms",
  "Discover what friends care about",
  "Other",
]);

const allowedServices = new Set(["Spotify", "YouTube", "Apple Music", "Other"]);

type SubmissionBody = {
  name?: unknown;
  email?: unknown;
  lifeDecade?: unknown;
  musicMeaning?: unknown;
  collectionHistory?: unknown;
  collectionGoals?: unknown;
  collectionGoalOther?: unknown;
  musicServices?: unknown;
  musicServiceOther?: unknown;
  meaningfulStory?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SubmissionBody | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: return a generic success so bots do not learn the field worked.
  if (cleanString(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = cleanString(body.name, 120);
  const email = cleanString(body.email, 320).toLowerCase();
  const lifeDecade = cleanString(body.lifeDecade, 40);
  const musicMeaning = Number(body.musicMeaning);
  const collectionHistory = cleanStringArray(body.collectionHistory, allowedHistory);
  const collectionGoals = cleanStringArray(body.collectionGoals, allowedGoals);
  const collectionGoalOther = cleanString(body.collectionGoalOther, 240) || null;
  const musicServices = cleanStringArray(body.musicServices, allowedServices);
  const musicServiceOther = cleanString(body.musicServiceOther, 240) || null;
  const meaningfulStory = cleanString(body.meaningfulStory, 2000) || null;
  const turnstileToken = cleanString(body.turnstileToken, 2048);

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "Please provide a valid name and email address." },
      { status: 400 },
    );
  }

  if (!allowedDecades.has(lifeDecade)) {
    return NextResponse.json({ error: "Choose an age range." }, { status: 400 });
  }

  if (!Number.isInteger(musicMeaning) || musicMeaning < 1 || musicMeaning > 10) {
    return NextResponse.json(
      { error: "Music meaning must be between 1 and 10." },
      { status: 400 },
    );
  }

  if (
    collectionHistory.length === 0 ||
    collectionGoals.length === 0 ||
    musicServices.length === 0
  ) {
    return NextResponse.json(
      { error: "Please complete each required section." },
      { status: 400 },
    );
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

  if (turnstileSecret) {
    if (!turnstileToken) {
      return NextResponse.json(
        { error: "Please complete the anti-spam check." },
        { status: 400 },
      );
    }

    const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const verification = await verifyTurnstile({
      secret: turnstileSecret,
      token: turnstileToken,
      remoteIp,
    });

    if (!verification) {
      return NextResponse.json(
        { error: "The anti-spam check could not be verified. Try again." },
        { status: 400 },
      );
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server environment variables.");
    return NextResponse.json(
      { error: "Beta requests are temporarily unavailable." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.from("beta_access_requests").insert({
    status: "New",
    name,
    email,
    life_decade: lifeDecade,
    music_meaning: musicMeaning,
    collection_history: collectionHistory,
    collection_goals: collectionGoals,
    collection_goal_other: collectionGoalOther,
    music_services: musicServices,
    music_service_other: musicServiceOther,
    meaningful_story: meaningfulStory,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A beta request already exists for this email address." },
        { status: 409 },
      );
    }

    console.error("Beta request insert failed", error);
    return NextResponse.json(
      { error: "We couldn't save your request. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanStringArray(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => allowed.has(item)),
    ),
  );
}

async function verifyTurnstile({
  secret,
  token,
  remoteIp,
}: {
  secret: string;
  token: string;
  remoteIp?: string;
}) {
  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", token);
  if (remoteIp) formData.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      },
    );

    const result = (await response.json().catch(() => null)) as {
      success?: boolean;
    } | null;

    return result?.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}
