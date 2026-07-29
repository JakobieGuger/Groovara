import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Groovara",
  description:
    "Learn why Groovara is built to help people give music meaningfully.",
};

function GroovaraRingMark({
  className,
}: {
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute block ${className}`}
      style={{
        WebkitMaskImage: 'url("/groovara-rings-3-2-mask.png")',
        maskImage: 'url("/groovara-rings-3-2-mask.png")',
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export default function AboutPage() {
  return (
    <main className="gv-paper-bg relative min-h-screen overflow-hidden text-foreground">
      <GroovaraRingMark className="-left-36 top-20 h-80 w-80 bg-[#57577F]/[0.045] sm:-left-24 sm:h-96 sm:w-96 dark:bg-[#CED7DF]/[0.035]" />
      <GroovaraRingMark className="-bottom-24 -right-28 h-72 w-72 rotate-180 bg-[#57577F]/[0.04] sm:h-96 sm:w-96 dark:bg-[#CED7DF]/[0.03]" />

      <div className="gv-paper-content relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-20 sm:px-10 sm:pb-32 sm:pt-28 lg:px-12">
        <header className="mx-auto max-w-3xl text-center">

          <h1 className="gv-accent mt-4 text-4xl font-semibold tracking-wide sm:text-5xl">
            About Groovara
          </h1>
        </header>

        <article className="mx-auto mt-14 max-w-3xl sm:mt-20">
          <section className="text-center">
            <p className="text-xl font-medium leading-9 text-foreground sm:text-2xl sm:leading-10">
              People have always used music to say what words alone
              couldn&apos;t.
            </p>

            <p className="gv-accent mt-5 text-lg font-medium tracking-wide sm:text-xl">
              A lullaby. A protest. A love song.
            </p>
          </section>

          <section className="mt-14 border-y border-border py-10 sm:mt-16 sm:py-12">
            <p className="text-base font-light leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              Music hasn&apos;t changed, but the way we share it has. We have
              access to more music than at any other time in history. We&apos;ve
              built incredible tools for finding it, organizing it, and playing
              it. But none of them were built for what music has always done
              best. What was once handed to someone became something scrolled
              past.
            </p>
          </section>

          <section className="py-14 text-center sm:py-18">
            <p className="gv-accent text-3xl font-semibold leading-tight sm:text-4xl">
              Groovara is built for giving.
            </p>
          </section>

          <section className="space-y-8">
            <p className="text-base font-light leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              A Mixlist isn&apos;t a collection of songs. It&apos;s a message.
              Like a mixtape, it unfolds one song at a time. You don&apos;t know
              what&apos;s next until it arrives, and that not-knowing is part of
              the gift. Move one song, and the meaning changes.
            </p>

            <div className="gv-row rounded-3xl border border-[#57577F]/15 px-6 py-7 sm:px-8 sm:py-8 dark:border-[#CED7DF]/10">
              <p className="text-base font-light leading-8 text-muted-foreground sm:text-lg sm:leading-9">
                We work alongside the streaming platforms you already use,
                including{" "}
                <span className="font-medium text-foreground">
                  Spotify, Apple Music, YouTube,
                </span>{" "}
                and more to come. They deliver the songs. 
                <br />
                <br />
                We help you deliver what the songs mean.
              </p>
            </div>
          </section>

          <section className="mt-16 border-t border-border pt-12 text-center sm:mt-20 sm:pt-16">
            <p className="mx-auto max-w-2xl text-lg font-light leading-8 text-muted-foreground sm:text-xl sm:leading-9">
              Every Mixlist begins with one person trying to say something to
              another.
            </p>

            <p className="mt-9 text-lg text-foreground sm:text-xl">
              In the end, that&apos;s all any of us want.
            </p>

            <p className="gv-accent mt-5 text-4xl font-semibold tracking-wide sm:text-5xl">
              To be heard.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}