import { listBetaApplications } from "@/db/applications";
import { unauthorizedResponse, verifyAdminRequest } from "@/db/admin-auth";

export async function GET(request: Request) {
  if (!(await verifyAdminRequest(request))) {
    return unauthorizedResponse();
  }

  const applications = await listBetaApplications("created_at", "desc");
  const header = [
    "Created At",
    "Status",
    "Name",
    "Email",
    "Decade",
    "Music Meaning",
    "Created Collections",
    "Collection Goals",
    "Goal Other",
    "Music Services",
    "Service Other",
    "Meaningful Story",
  ];
  const rows = applications.map((application) => [
    new Date(application.createdAt).toISOString(),
    application.status,
    application.name,
    application.email,
    application.lifeDecade,
    String(application.musicMeaning),
    application.collectionHistory.join("; "),
    application.collectionGoals.join("; "),
    application.collectionGoalOther,
    application.musicServices.join("; "),
    application.musicServiceOther,
    application.meaningfulStory,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="groovara-beta-applications.csv"`,
    },
  });
}

function formatCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
