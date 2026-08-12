"use client";

import { motion, type Variants } from "framer-motion";
import EmbeddedPlayer from "./EmbeddedPlayer";
import ProgressBar from "./ProgressBar";
import type { UiTrack } from "./types";

type TrackViewProps = {
  track: UiTrack;
  isActive: boolean;
  isRevealed: boolean;
  showNotes: boolean;
  notes?: string | null;
  onPlay?: () => void;
  onReveal?: () => void;
  disabledReason?: string | null;
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  disabledPrev?: boolean;
  disabledNext?: boolean;
  autoplay?: boolean;
};

const itemVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function TrackView({
  track,
  isActive,
  isRevealed,
  showNotes,
  notes,
  disabledReason,
  onPrev,
  onNext,
  prevLabel = "PREVIOUS SONG",
  nextLabel = "NEXT SONG",
  disabledPrev = false,
  disabledNext = false,
  autoplay = false,
}: TrackViewProps) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border bg-card/70 p-5 backdrop-blur-md sm:p-6"
      style={{
        color: track.theme.textColor,
        backgroundColor: track.theme.backgroundColor,
      }}
    >
      <motion.div
        className="relative z-10 space-y-4"
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
      >
        <motion.div variants={itemVariants}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={disabledPrev || !onPrev}
              className="rounded-xl border border-border bg-card/70 px-4 py-2 text-xs tracking-wide text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {prevLabel}
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={disabledNext || !onNext}
              className="rounded-xl border border-border bg-muted px-4 py-2 text-xs tracking-wide text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {nextLabel}
            </button>
          </div>

          {disabledReason ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {disabledReason}
            </p>
          ) : null}
        </motion.div>

        <motion.div variants={itemVariants}>
          <ProgressBar currentMs={isActive ? 0 : 0} durationMs={1} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <EmbeddedPlayer
            url={track.url}
            platform={track.platform}
            trackId={
              (track as UiTrack & { trackId?: string | null }).trackId ?? null
            }
            isHidden={!isRevealed}
            title={track.title}
            artist={track.artist}
            autoplay={autoplay}
          />
        </motion.div>

        {showNotes ? (
          <motion.div
            className="rounded-2xl border border-border bg-card/70 p-4"
            variants={itemVariants}
          >
            {!isRevealed ? (
              <p className="text-sm text-muted-foreground">
                Reveal this song to see the note.
              </p>
            ) : (notes ?? "").trim().length > 0 ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No note for this song.
              </p>
            )}
          </motion.div>
        ) : null}
      </motion.div>
    </section>
  );
}
