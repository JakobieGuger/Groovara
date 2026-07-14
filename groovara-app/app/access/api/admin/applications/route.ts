import {
  listBetaApplications,
  statusValues,
} from "@/db/applications";
import { unauthorizedResponse, verifyAdminRequest } from "@/db/admin-auth";

export async function GET(request: Request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort");
  const dirParam = url.searchParams.get("dir");
  const sort = sortParam === "status" ? "status" : "created_at";
  const direction = dirParam === "asc" ? "asc" : "desc";
  const applications = await listBetaApplications(sort, direction);

  return Response.json({
    applications,
    statuses: statusValues,
  });
}
