import { verifyAdminRequest } from "@/db/admin-auth";

export async function GET(request: Request) {
  return Response.json({ authenticated: await verifyAdminRequest(request) });
}
