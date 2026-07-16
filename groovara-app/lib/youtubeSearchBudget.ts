import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_AUTOMATIC_SEARCH_DAILY_LIMIT = 70;

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
};

function getConfiguredDailyLimit() {
  const raw = process.env.YOUTUBE_AUTOMATIC_SEARCH_DAILY_LIMIT;
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return DEFAULT_AUTOMATIC_SEARCH_DAILY_LIMIT;
  }

  return parsed;
}

function normalizeRpcRow(
  row: BudgetRpcRow | null | undefined,
): YouTubeSearchBudgetStatus {
  const dailyLimit =
    Number(row?.daily_limit) || getConfiguredDailyLimit();
  const used = Math.max(0, Number(row?.used) || 0);
  const remaining = Math.max(
    0,
    Number.isFinite(Number(row?.remaining))
      ? Number(row?.remaining)
      : dailyLimit - used,
  );

  return {
    allowed: row?.allowed === true,
    quotaDay: String(row?.quota_day ?? ""),
    used,
    remaining,
    dailyLimit,
    resetsAt: String(row?.resets_at ?? ""),
  };
}

async function runBudgetClaim(
  amount: number,
): Promise<YouTubeSearchBudgetStatus> {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("YouTube search budget amount must be a non-negative integer.");
  }

  const admin = createAdminClient();
  const dailyLimit = getConfiguredDailyLimit();

  const { data, error } = await admin.rpc(
    "claim_youtube_search_budget",
    {
      p_amount: amount,
      p_limit: dailyLimit,
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

  return normalizeRpcRow(firstRow);
}

export async function getYouTubeSearchBudgetStatus() {
  return runBudgetClaim(0);
}

export async function claimYouTubeAutomaticSearchBudget(
  amount = 1,
) {
  return runBudgetClaim(amount);
}
