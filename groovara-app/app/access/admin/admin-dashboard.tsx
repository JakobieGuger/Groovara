"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/lib/ThemeToggle";
import { supabase } from "../../../lib/supabaseClient";

type ApplicationStatus =
  | "New"
  | "Invited"
  | "Accepted"
  | "Declined"
  | "Contacted";

type BetaApplication = {
  id: string;
  created_at: string;
  updated_at: string;
  status: ApplicationStatus;
  name: string;
  email: string;
  life_decade: string;
  music_meaning: number;
  collection_history: string[];
  collection_goals: string[];
  collection_goal_other: string | null;
  music_services: string[];
  music_service_other: string | null;
  meaningful_story: string | null;
};

const statuses: ApplicationStatus[] = [
  "New",
  "Invited",
  "Accepted",
  "Declined",
  "Contacted",
];

type AccessState = "checking" | "signed_out" | "denied" | "ready" | "error";

export function AdminDashboard() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !userData.user) {
        setAccessState("signed_out");
        return;
      }

      const { data: adminRow, error: adminError } = await supabase
        .from("beta_access_admins")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!active) return;

      if (adminError) {
        setMessage(adminError.message);
        setAccessState("error");
        return;
      }

      if (!adminRow) {
        setAccessState("denied");
        return;
      }

      setAccessState("ready");
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (accessState !== "ready") return;
    void loadApplications(sortDirection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessState]);

  const counts = useMemo(() => {
    return statuses.reduce(
      (nextCounts, status) => {
        nextCounts[status] = applications.filter(
          (application) => application.status === status,
        ).length;
        return nextCounts;
      },
      {} as Record<ApplicationStatus, number>,
    );
  }, [applications]);

  async function loadApplications(direction = sortDirection) {
    setIsLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("beta_access_requests")
      .select("*")
      .order("created_at", { ascending: direction === "asc" });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setApplications((data ?? []) as BetaApplication[]);
    setIsLoading(false);
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    const previous = applications;

    setApplications((current) =>
      current.map((application) =>
        application.id === id ? { ...application, status } : application,
      ),
    );

    const { error } = await supabase
      .from("beta_access_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setApplications(previous);
      setMessage(`Could not update status: ${error.message}`);
    }
  }

  function toggleDateSort() {
    const nextDirection = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(nextDirection);
    void loadApplications(nextDirection);
  }

  function exportCsv() {
    const headers = [
      "Date",
      "Status",
      "Name",
      "Email",
      "Age range",
      "Music meaning",
      "Collection history",
      "Goals",
      "Goal other",
      "Services",
      "Service other",
      "Story",
    ];

    const rows = applications.map((application) => [
      application.created_at,
      application.status,
      application.name,
      application.email,
      application.life_decade,
      String(application.music_meaning),
      application.collection_history.join("; "),
      application.collection_goals.join("; "),
      application.collection_goal_other ?? "",
      application.music_services.join("; "),
      application.music_service_other ?? "",
      application.meaningful_story ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `groovara-beta-requests-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="access-admin-page">
      <div aria-hidden="true" className="access-ring access-ring-hero" />

      <header className="access-header" aria-label="Groovara beta admin">
        <Link className="access-brand" href="/">
          <span className="access-logo-wrap">
            <Image
              alt=""
              aria-hidden="true"
              height={24}
              priority
              src="/groovara-icon-v2.png"
              width={24}
            />
          </span>
          <span>GROOVARA</span>
        </Link>

        <div className="access-header-actions">
          <Link className="access-header-link" href="/access">
            Open request form
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="access-admin-main">
        <div className="access-admin-title">
          <div>
            <p className="access-eyebrow">Beta requests</p>
            <h1>Invitation room</h1>
            <p>
              Review requests, change their status, and export the current list
              without maintaining a separate admin password system.
            </p>
          </div>
        </div>

        {accessState === "checking" ? (
          <AdminNotice>Checking your Groovara account…</AdminNotice>
        ) : null}

        {accessState === "signed_out" ? (
          <AdminNotice>
            <p>Sign in with an authorized Groovara account to continue.</p>
            <Link
              className="access-primary-button access-button-compact"
              href="/login?next=/access/admin"
            >
              Sign in
            </Link>
          </AdminNotice>
        ) : null}

        {accessState === "denied" ? (
          <AdminNotice>
            This Groovara account is not listed as a beta-access administrator.
          </AdminNotice>
        ) : null}

        {accessState === "error" ? (
          <AdminNotice>{message || "Could not verify admin access."}</AdminNotice>
        ) : null}

        {accessState === "ready" ? (
          <section className="access-admin-panel">
            <div className="access-admin-toolbar">
              <div>
                <p className="access-metric-label">Requests</p>
                <strong>{applications.length}</strong>
              </div>

              <div className="access-admin-actions">
                <button
                  className="access-secondary-button"
                  disabled={isLoading}
                  type="button"
                  onClick={toggleDateSort}
                >
                  {sortDirection === "desc" ? "Newest first" : "Oldest first"}
                </button>
                <button
                  className="access-secondary-button"
                  disabled={applications.length === 0}
                  type="button"
                  onClick={exportCsv}
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="access-metric-row" aria-label="Status totals">
              {statuses.map((status) => (
                <div className="access-metric" key={status}>
                  <span className="access-metric-label">{status}</span>
                  <strong>{counts[status]}</strong>
                </div>
              ))}
            </div>

            {message ? (
              <p className="access-admin-message" role="alert">
                {message}
              </p>
            ) : null}

            {applications.length > 0 ? (
              <div className="access-table-wrap">
                <table className="access-applications-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Person</th>
                      <th scope="col">Listening</th>
                      <th scope="col">Services</th>
                      <th scope="col">Story</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td>
                          {formatDate(application.created_at)}
                          <br />
                          <span className="access-muted">
                            Meaning {application.music_meaning}/10
                          </span>
                        </td>
                        <td>
                          <strong>{application.name}</strong>
                          <br />
                          <a href={`mailto:${application.email}`}>
                            {application.email}
                          </a>
                          <br />
                          <span className="access-muted">
                            {application.life_decade}
                          </span>
                        </td>
                        <td>
                          <ListText items={application.collection_history} />
                          <br />
                          <span className="access-muted">
                            <ListText items={application.collection_goals} />
                            {application.collection_goal_other
                              ? `; ${application.collection_goal_other}`
                              : ""}
                          </span>
                        </td>
                        <td>
                          <ListText items={application.music_services} />
                          {application.music_service_other ? (
                            <>
                              <br />
                              <span className="access-muted">
                                {application.music_service_other}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td className="access-story-cell">
                          {application.meaningful_story ? (
                            application.meaningful_story
                          ) : (
                            <span className="access-muted">No story added</span>
                          )}
                        </td>
                        <td>
                          <label
                            className="access-sr-only"
                            htmlFor={`status-${application.id}`}
                          >
                            Status for {application.name}
                          </label>
                          <select
                            className="access-status-select"
                            id={`status-${application.id}`}
                            value={application.status}
                            onChange={(event) =>
                              void updateStatus(
                                application.id,
                                event.target.value as ApplicationStatus,
                              )
                            }
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="access-empty-state">
                {isLoading ? "Loading requests…" : "No beta requests yet."}
              </p>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function AdminNotice({ children }: { children: React.ReactNode }) {
  return <section className="access-admin-notice">{children}</section>;
}

function ListText({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="access-muted">None selected</span>;
  }

  return <>{items.join("; ")}</>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeCsvCell(value: string) {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}
