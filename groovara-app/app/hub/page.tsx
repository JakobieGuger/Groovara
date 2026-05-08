import Link from "next/link";

export default function HubPage() {
  return (
    <main className="gv-paper-bg min-h-screen">
      <div className="gv-paper-content">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-36 sm:pt-44 dark:pb-20 dark:pt-28 dark:sm:pt-32">
          {/* HERO */}
          <div className="mx-auto max-w-4xl py-24 text-center dark:py-0">
            {/* Serif headline like earlier screenshot */}
            <h1 className="font-serif text-4xl font-medium tracking-tight text-[#2c2a26] dark:font-sans dark:text-foreground sm:text-5xl">
              Welcome back to your listening room.
            </h1>

            {/* Serif italic subhead */}
            <p className="mt-6 font-serif text-2xl italic text-[#6a6358] dark:font-sans dark:text-muted-foreground sm:text-3xl">
              What are you shaping today?
            </p>

            {/* Ornament divider (adds character) */}
            <div className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-4 text-[#6a6358]/70 dark:text-muted-foreground/70">
              <div className="h-px flex-1 bg-border/70" />
              <span className="text-xs tracking-[0.35em]">✦</span>
              <div className="h-px flex-1 bg-border/70" />
            </div>
          </div>

          {/* CARDS */}
          <div className="mx-auto mt-10 grid max-w-5xl gap-7 dark:mt-10 dark:gap-6 lg:grid-cols-2">
            <StudioPanel
              title="STUDIO"
              subtitle="Your private listening space."
              panelClassName="bg-[#f7f2e8] dark:bg-studio-track"
              primaryHref="/tracklists/new"
              primaryLabel="+ Start a new Mixlist"
              primaryDescription="Shape music for yourself."
              secondaryHref="/tracklists"
              secondaryLabel="See my Mixlist Concepts →"
            />

            <StudioPanel
              title="MIXLISTS"
              subtitle="Music shared with intention."
              panelClassName="bg-[#f5efe4] dark:bg-studio-mix"
              primaryHref="/tracklists"
              primaryLabel="+ Publish a Mixlist"
              primaryDescription="Build something meant to travel."
              secondaryHref="/mixlists"
              secondaryLabel="See my Mixlists →"
              microInfo=""
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function StudioPanel({
  title,
  subtitle,
  panelClassName,
  primaryHref,
  primaryLabel,
  primaryDescription,
  secondaryHref,
  secondaryLabel,
  microInfo,
}: {
  title: string;
  subtitle: string;
  panelClassName: string;
  primaryHref: string;
  primaryLabel: string;
  primaryDescription: string;
  secondaryHref: string;
  secondaryLabel: string;
  microInfo?: string;
}) {
  return (
    <section
      className={[
        "group rounded-2xl border border-[#d2c9ba] bg-card p-10 transition duration-200 ease-out",
        // “paper stack” shadow (stronger character)
        "shadow-[0_2px_4px_rgba(40,30,20,0.08),0_14px_32px_rgba(40,30,20,0.18)]",
        "hover:-translate-y-0.5 hover:shadow-[0_3px_6px_rgba(40,30,20,0.10),0_18px_40px_rgba(40,30,20,0.22)]",
        "dark:border-border/70 dark:p-8 dark:shadow-[0_10px_28px_rgba(0,0,0,0.34)] dark:hover:-translate-y-1 dark:hover:shadow-[0_18px_34px_rgba(0,0,0,0.44)]",
        "sm:p-11 dark:sm:p-9",
        panelClassName,
      ].join(" ")}
    >
      {/* Serif section title like earlier screenshot */}
      <h2 className="font-serif text-3xl font-medium tracking-wide text-[#2c2a26] transition duration-200 group-hover:font-semibold dark:font-semibold dark:text-foreground dark:group-hover:font-bold sm:text-4xl">
        {title}
      </h2>

      <p className="mt-2 text-base text-[#6a6358] dark:text-muted-foreground sm:text-lg">
        {subtitle}
      </p>

      <div className="mt-7 border-t border-[#d8d0c3] pt-7 dark:border-border/60">
        {/* Actions stay sans for clarity */}
        <Link
          href={primaryHref}
          className="inline-block font-sans text-3xl font-medium tracking-tight text-[#2c2a26] dark:text-foreground"
        >
          {primaryLabel}
        </Link>

        <p className="mt-2 text-lg text-[#6a6358] dark:text-muted-foreground">
          {primaryDescription}
        </p>
      </div>

      <div className="mt-9 border-t border-[#d8d0c3] pt-6 dark:border-border/60">
        <Link
          href={secondaryHref}
          className="inline-block font-sans text-3xl font-medium tracking-tight text-[#2c2a26] dark:text-foreground"
        >
          {secondaryLabel}
        </Link>

        {microInfo ? (
          <p className="mt-2 text-sm text-[#6a6358] dark:text-muted-foreground">
            {microInfo}
          </p>
        ) : null}
      </div>
    </section>
  );
}