"use client";

import type { MouseEvent } from "react";

type ProgressBarProps = {
  currentMs: number;
  durationMs: number;
  onSeek?: (ms: number) => void;
};

export default function ProgressBar({ currentMs, durationMs, onSeek }: ProgressBarProps) {
  const safeDuration = durationMs > 0 ? durationMs : 1;
  const progress = Math.max(0, Math.min(100, (currentMs / safeDuration) * 100));

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onSeek) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pct = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    onSeek(Math.round(Math.max(0, Math.min(1, pct)) * safeDuration));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="block h-1.5 w-full overflow-hidden rounded-full border border-border bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      aria-label="Seek"
    >
      <div
        className="h-full rounded-full bg-muted-foreground/70 transition-[width] duration-200 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </button>
  );
}
