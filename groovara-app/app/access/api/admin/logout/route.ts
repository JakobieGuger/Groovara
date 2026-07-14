import { clearAdminSessionCookie } from "@/db/admin-auth";

export async function POST() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearAdminSessionCookie(),
      },
    },
  );
}
