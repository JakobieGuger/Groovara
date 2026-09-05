import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_AUTOMATIC_SEARCH_DAILY_LIMIT = 70;
const DEFAULT_PRIORITY_SEARCH_RESERVE = 20;

export type YouTubeSearchBudgetPurpose = "priority" | "studio";

type BudgetRpcRow = {
  allowed?: boolean;
  quota_day?: string;
  used?: number;
  remaining?: number;
  daily_limit?: number;
  resets_at?: string;
};

export type YouTubeSearchBudgetStatus = {
  allowed: boolean;
  quotaDay: string;
  used: number;
  remaining: number;
  dailyLimit: number;
  resetsAt: string;
  purpose?: YouTubeSearchBudgetPurpose;
  reservedForPriority?: number;
  availableForPurpose?: number;
};

function getConfiguredDailyLimit() {
  const raw = process.env.YOUTUBE_AUTOMATIC_SEARCH_DAILY_LIMIT;
  const parsed = Number.parseInt(raw ?? "", 10);

  // Keep this configurable above 100 so Groovara can raise the internal cap
  // if/when YouTube approves a larger search.list quota.
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1_000_000) {
    return DEFAULT_AUTOMATIC_SEARCH_DAILY_LIMIT;
  }

  return parsed;
}

function getConfiguredPriorityReserve(dailyLimit: number) {
  const raw = process.env.YOUTUBE_PRIORITY_SEARCH_RESERVE;
  const parsed = Number.parseInt(raw ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 0 && parsed < dailyLimit) {
    return parsed;
  }

  return Math.min(
    DEFAULT_PRIORITY_SEARCH_RESERVE,
    Math.max(0, dailyLimit - 1),
  );
}

function normalizeRpcRow(
  row: BudgetRpcRow | null | undefined,
  options: {
    totalDailyLimit: number;
    claimLimit: number;
    purpose: YouTubeSearchBudgetPurpose;
  },
): YouTubeSearchBudgetStatus {
  const used = Math.max(0, Number(row?.used) || 0);
  const remaining = Math.max(0, options.totalDailyLimit - used);
  const availableForPurpose = Math.max(0, options.claimLimit - used);

  return {
    allowed: row?.allowed === true,
    quotaDay: String(row?.quota_day ?? ""),
    used,
    remaining,
    dailyLimit: options.totalDailyLimit,
    resetsAt: String(row?.resets_at ?? ""),
    purpose: options.purpose,
    reservedForPriority:
      options.purpose === "studio"
        ? Math.max(0, options.totalDailyLimit - options.claimLimit)
        : 0,
    availableForPurpose,
  };
}

async function runBudgetClaim(
  amount: number,
  options: {
    purpose: YouTubeSearchBudgetPurpose;
    claimLimit: number;
    totalDailyLimit: number;
  },
): Promise<YouTubeSearchBudgetStatus> {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(
      "YouTube search budget amount must be a non-negative integer.",
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc(
    "claim_youtube_search_budget",
    {
      p_amount: amount,
      p_limit: options.claimLimit,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Failed to evaluate the YouTube search budget.",
    );
  }

  const firstRow = Array.isArray(data)
    ? (data[0] as BudgetRpcRow | undefined)
    : (data as BudgetRpcRow | null);

  return normalizeRpcRow(firstRow, options);
}

export async function getYouTubeSearchBudgetStatus() {
  const dailyLimit = getConfiguredDailyLimit();

  return runBudgetClaim(0, {
    purpose: "priority",
    claimLimit: dailyLimit,
    totalDailyLimit: dailyLimit,
  });
}

export async function claimYouTubeSearchBudget(
  amount = 1,
  purpose: YouTubeSearchBudgetPurpose = "priority",
) {
  const dailyLimit = getConfiguredDailyLimit();
  const reserve = getConfiguredPriorityReserve(dailyLimit);

  // Studio gets the lower atomic claim ceiling. Priority requests can keep
  // using the full internal allowance after Studio is cut off.
  const claimLimit =
    purpose === "studio"
      ? Math.max(1, dailyLimit - reserve)
      : dailyLimit;

  return runBudgetClaim(amount, {
    purpose,
    claimLimit,
    totalDailyLimit: dailyLimit,
  });
}

// Backward-compatible name used by existing export/conversion code.
export async function claimYouTubeAutomaticSearchBudget(
  amount = 1,
) {
  return claimYouTubeSearchBudget(amount, "priority");
}
