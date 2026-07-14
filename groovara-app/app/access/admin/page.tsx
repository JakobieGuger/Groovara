import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Beta Requests | Groovara",
};

export default function AccessAdminPage() {
  return <AdminDashboard />;
}
