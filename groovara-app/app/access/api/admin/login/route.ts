import {
  createAdminSessionCookie,
  getAdminPasscode,
} from "@/db/admin-auth";

export async function POST(request: Request) {
  const expectedPasscode = getAdminPasscode(request);

  if (!expectedPasscode) {
    return Response.json(
      { error: "Admin passcode is not configured." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    passcode?: string;
  } | null;

  if (!payload?.passcode || payload.passcode !== expectedPasscode) {
    return Response.json({ error: "That passcode did not match." }, { status: 401 });
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": await createAdminSessionCookie(request),
      },
    },
  );
}
