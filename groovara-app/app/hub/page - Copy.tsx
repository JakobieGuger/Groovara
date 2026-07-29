import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TracklistSummary = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
};

type MixlistSummary = {
  id: string;
  title: string | null;
  created_at: string;
};

type ReceiptSummary = {
  mixlist_id: string;
  first_opened_at: string;
  last_opened_at: string;
};

type SentArchiveSummary = {
  mixlist_id: string;
};

type RecentItem = {
  title: string;
  href: string;
  meta: string;
};

function getTimestamp(
  row: Pick<TracklistSummary, "created_at" | "updated_at">,
) {
  return new Date(row.updated_at ?? row.created_at).getTime();
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === now.getFullYear()
        ? undefined
        : "numeric",
  });
}

function itemTitle(value: string | null | undefined) {
  const title = value?.trim();
  return title || "Untitled Mixlist";
}

function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function HubPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/hub");
  }

  const [
    draftResult,
    sentResult,
    receiptResult,
    sentArchiveResult,
  ] = await Promise.all([
    supabase
      .from("tracklists")
      .select("id,title,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("status", "draft"),
    supabase
      .from("mixlists")
      .select("id,title,created_at")
      .eq("owner_user_id", user.id),
    supabase
      .from("mixlist_receipts")
      .select(
        "mixlist_id,first_opened_at,last_opened_at",
      )
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("last_opened_at", { ascending: false }),
    supabase
      .from("sent_mixlist_archives")
      .select("mixlist_id")
      .eq("user_id", user.id),
  ]);

  if (draftResult.error) {
    console.error("Hub drafts failed to load", draftResult.error);
  }

  if (sentResult.error) {
    console.error("Hub sent Mixlists failed to load", sentResult.error);
  }

  if (receiptResult.error) {
    console.error(
      "Hub received Mixlists failed to load",
      receiptResult.error,
    );
  }

  if (sentArchiveResult.error) {
    console.error(
      "Hub sent archives failed to load",
      sentArchiveResult.error,
    );
  }

  const drafts = (
    (draftResult.data ?? []) as TracklistSummary[]
  ).sort((a, b) => getTimestamp(b) - getTimestamp(a));

  const archivedSentIds = new Set(
    (
      (sentArchiveResult.data ?? []) as SentArchiveSummary[]
    ).map((row) => row.mixlist_id),
  );

  const sent = (
    (sentResult.data ?? []) as MixlistSummary[]
  )
    .filter((mixlist) => !archivedSentIds.has(mixlist.id))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );

  const receipts =
    (receiptResult.data ?? []) as ReceiptSummary[];
  const receivedIds = receipts.map(
    (receipt) => receipt.mixlist_id,
  );

  let receivedMixlists: MixlistSummary[] = [];

  if (receivedIds.length > 0) {
    const { data, error } = await supabase
      .from("mixlists")
      .select("id,title,created_at")
      .in("id", receivedIds);

    if (error) {
      console.error(
        "Hub received Mixlist details failed to load",
        error,
      );
    } else {
      receivedMixlists = (data ?? []) as MixlistSummary[];
    }
  }

  const receivedById = new Map(
    receivedMixlists.map((mixlist) => [
      mixlist.id,
      mixlist,
    ]),
  );

  const visibleReceipts = receipts.filter((receipt) =>
    receivedById.has(receipt.mixlist_id),
  );

  const latestDraft = drafts[0];
  const latestSent = sent[0];
  const latestReceipt = visibleReceipts[0];
  const latestReceived = latestReceipt
    ? receivedById.get(latestReceipt.mixlist_id)
    : null;

  const draftItem: RecentItem | null = latestDraft
    ? {
        title: itemTitle(latestDraft.title),
        href: `/tracklists/${latestDraft.id}`,
        meta: `Edited ${
          formatRelativeDate(
            latestDraft.updated_at ??
              latestDraft.created_at,
          ) ?? "recently"
        }`,
      }
    : null;

  const sentItem: RecentItem | null = latestSent
    ? {
        title: itemTitle(latestSent.title),
        href: `/mixlists/${latestSent.id}`,
        meta: `Sent ${
          formatRelativeDate(latestSent.created_at) ??
          "recently"
        }`,
      }
    : null;

  const receivedItem: RecentItem | null =
    latestReceipt && latestReceived
      ? {
          title: itemTitle(latestReceived.title),
          href: `/mixlists/${latestReceived.id}`,
          meta: `Opened ${
            formatRelativeDate(
              latestReceipt.last_opened_at,
            ) ?? "recently"
          }`,
        }
      : null;

  return (
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content">
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-28 sm:px-8 sm:pt-36 dark:pb-20 dark:pt-28">
          {/* HERO */}
          <section className="mx-auto max-w-5xl text-center">
            <h1 className="font-serif text-4xl font-medium tracking-tight text-[#2c2a26] dark:font-sans dark:text-foreground sm:text-5xl">
              Welcome back to your listening room.
            </h1>

            <p className="mt-6 font-serif text-2xl italic text-[#6a6358] dark:font-sans dark:text-muted-foreground sm:text-3xl">
              What are you shaping today?
            </p>
          </section>

          {/* MAIN HUB LAYOUT */}
          <section className="mx-auto mt-16 grid max-w-7xl gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center">
            {/* LIVE MIXLIST SUMMARY */}
            <aside className="border border-[#cfc6b8] bg-[#f7f1e7]/90 p-8 shadow-[0_4px_14px_rgba(40,30,20,0.20)] dark:border-border/70 dark:bg-card/70 dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              <h2 className="text-center text-2xl font-black tracking-[0.22em] text-[#15130f] dark:text-foreground">
                MIXLISTS
              </h2>

              <div className="mt-10 space-y-9">
                <DashboardSection
                  title="IN PROGRESS"
                  href="/tracklists"
                  countLabel={formatCount(
                    drafts.length,
                    "draft",
                  )}
                  latest={draftItem}
                  emptyText="No drafts yet."
                  emptyHint="Start in the Studio."
                />

                <DashboardSection
                  title="SENT"
                  href="/tracklists?tab=sent"
                  countLabel={formatCount(
                    sent.length,
                    "shared Mixlist",
                    "shared Mixlists",
                  )}
                  latest={sentItem}
                  emptyText="Nothing sent yet."
                  emptyHint="Finished Mixlists appear here."
                />

                <DashboardSection
                  title="RECEIVED"
                  href="/tracklists?tab=received"
                  countLabel={formatCount(
                    visibleReceipts.length,
                    "saved Mixlist",
                    "saved Mixlists",
                  )}
                  latest={receivedItem}
                  emptyText="Nothing received yet."
                  emptyHint="Shared Mixlists appear here."
                />
              </div>
            </aside>

            {/* CENTER CTA — VISUALS PRESERVED */}
            <div className="flex justify-center">
              <Link
                href="/tracklists"
                className={[
                  "group block w-full max-w-3xl border border-[#b8b0a5] bg-[#fffdf3] px-10 py-12",
                  "shadow-[0_0_0_6px_rgba(90,94,110,0.25),0_10px_22px_rgba(40,30,20,0.28)]",
                  "transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_6px_rgba(124,58,237,0.22),0_16px_34px_rgba(40,30,20,0.32)]",
                  "dark:border-border/80 dark:bg-card/80 dark:shadow-[0_0_0_6px_rgba(124,58,237,0.18),0_14px_34px_rgba(0,0,0,0.45)]",
                ].join(" ")}
              >
                <p className="text-2xl tracking-[0.32em] text-[#15130f] dark:text-foreground sm:text-3xl">
                  YOUR STUDIO
                </p>

                <h2 className="mt-14 max-w-2xl text-3xl font-light leading-tight tracking-[0.18em] text-[#15130f] dark:text-foreground sm:text-4xl">
                  Start a new Mixlist, continue where you left off, or refine a
                  draft
                </h2>

                <p className="mt-16 text-center font-serif text-base italic tracking-[0.35em] text-[#4f463c] transition group-hover:text-purple-700 dark:text-muted-foreground dark:group-hover:text-purple-300">
                  Shape it your way. No pressure to send.
                </p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function DashboardSection({
  title,
  href,
  countLabel,
  latest,
  emptyText,
  emptyHint,
}: {
  title: string;
  href: string;
  countLabel: string;
  latest: RecentItem | null;
  emptyText: string;
  emptyHint: string;
}) {
  return (
    <section>
      <Link
        href={href}
        className="text-sm font-black underline underline-offset-2 text-[#15130f] transition hover:text-purple-700 dark:text-foreground dark:hover:text-purple-300"
      >
        {title}
      </Link>

      {latest ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#625b52] dark:text-muted-foreground">
            {countLabel}
          </p>

          <div className="mt-3 flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.15rem] text-xs text-[#1f1b16] dark:text-muted-foreground"
            >
              •
            </span>

            <div className="min-w-0">
              <Link
                href={latest.href}
                className="line-clamp-2 text-sm font-medium text-[#1f1b16] transition hover:text-purple-700 dark:text-foreground dark:hover:text-purple-300"
              >
                {latest.title}
              </Link>

              <p className="mt-1 text-xs text-[#6a6358] dark:text-muted-foreground">
                {latest.meta}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          <span
            aria-hidden="true"
            className="mt-[0.15rem] text-xs text-[#1f1b16] dark:text-muted-foreground"
          >
            •
          </span>

          <div>
            <p className="text-sm text-[#1f1b16] dark:text-muted-foreground">
              {emptyText}
            </p>
            <p className="mt-1 text-xs text-[#6a6358] dark:text-muted-foreground">
              {emptyHint}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}