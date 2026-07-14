import {
  statusValues,
  updateApplicationStatus,
} from "@/db/applications";
import { unauthorizedResponse, verifyAdminRequest } from "@/db/admin-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => null)) as {
    status?: string;
  } | null;

  if (
    !payload?.status ||
    !statusValues.includes(payload.status as (typeof statusValues)[number])
  ) {
    return Response.json({ error: "Choose a valid status." }, { status: 400 });
  }

  const { id } = await context.params;
  const updated = await updateApplicationStatus(
    id,
    payload.status as (typeof statusValues)[number],
  );

  if (!updated) {
    return Response.json({ error: "Application not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
