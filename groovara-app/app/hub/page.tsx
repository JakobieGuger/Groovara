import Link from "next/link";

const inProgressMixlists = [
  "Open your Mixlist Studio.",
  "Build drafts before sharing.",
  "Edit songs, notes, and pacing.",
  "Turn unfinished ideas into sendable Mixlists.",
];

const sentMixlists = [
  "View Mixlists you’ve already shared.",
  "Copy links again when needed.",
  "Revisit finished listening experiences.",
  "Check what your recipients will see.",
];

export default function HubPage() {
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
            {/* LEFT MENU */}
            <aside className="border border-[#cfc6b8] bg-[#f7f1e7]/90 p-8 shadow-[0_4px_14px_rgba(40,30,20,0.20)] dark:border-border/70 dark:bg-card/70 dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              <h2 className="text-center text-2xl font-black tracking-[0.22em] text-[#15130f] dark:text-foreground">
                MIXLISTS
              </h2>

              <div className="mt-12 space-y-12">
                <MenuSection
                  title="IN PROGRESS"
                  href="/tracklists"
                  items={inProgressMixlists}
                  itemHref="/tracklists"
                />

                <MenuSection
                  title="SENT"
                  href="/mixlists"
                  items={sentMixlists}
                  itemHref="/mixlists"
                />
              </div>
            </aside>

            {/* CENTER CTA */}
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

function MenuSection({
  title,
  href,
  items,
  itemHref,
}: {
  title: string;
  href: string;
  items: string[];
  itemHref: string;
}) {
  return (
    <section>
      <Link
        href={href}
        className="text-sm font-black underline underline-offset-2 text-[#15130f] transition hover:text-purple-700 dark:text-foreground dark:hover:text-purple-300"
      >
        {title}
      </Link>

      <ul className="mt-5 space-y-3 text-sm text-[#1f1b16] dark:text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-[0.15rem] text-xs">•</span>
            <Link
              href={itemHref}
              className="transition hover:text-purple-700 dark:hover:text-purple-300"
            >
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}