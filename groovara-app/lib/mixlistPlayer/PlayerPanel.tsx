type PlayerPanelProps = {
  title: string;
  artist: string;
  disabledPrev: boolean;
  disabledNext: boolean;
  onPrev(): void;
  onNext(): void;
};

export default function PlayerPanel({
  title,
  artist,
  disabledPrev,
  disabledNext,
  onPrev,
  onNext,
}: PlayerPanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-muted/80 p-5">
      <p className="text-xs tracking-widest text-muted-foreground">NOW PLAYING</p>

      <div className="mt-3">
        <p className="text-sm text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{artist}</p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-border bg-card/70">
        <div className="h-full w-1/3 rounded-full bg-muted-foreground/45" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabledPrev}
          className="rounded-xl border border-border bg-card/70 px-3 py-2 text-xs tracking-wide text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          PREV
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabledNext}
          className="rounded-xl border border-border bg-card/70 px-3 py-2 text-xs tracking-wide text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          NEXT
        </button>
      </div>
    </section>
  );
}
