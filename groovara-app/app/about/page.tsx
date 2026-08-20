import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Groovara",
  description:
    "Learn what Groovara is built for, and what it deliberately chooses not to be.",
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

const sectionJumpButton =
  "inline-flex min-w-36 items-center justify-center rounded-full border border-[#5B4B6E]/30 bg-[#5B4B6E]/8 px-5 py-3 text-xs font-medium tracking-[0.18em] text-[#5B4B6E] transition hover:-translate-y-0.5 hover:bg-[#5B4B6E]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4B6E]/30 dark:border-[#C8BCA2]/25 dark:bg-[#F4EDDD]/5 dark:text-[#F4EDDD] dark:hover:bg-[#F4EDDD]/10";

export default function AboutPage() {
  return (
    <main className="gv-paper-bg relative min-h-screen overflow-hidden text-foreground">
      <GroovaraRingMark className="-left-36 top-20 h-80 w-80 bg-[#5B4B6E]/[0.045] sm:-left-24 sm:h-96 sm:w-96 dark:bg-[#C8BCA2]/[0.035]" />
      <GroovaraRingMark className="-bottom-24 -right-28 h-72 w-72 rotate-180 bg-[#5B4B6E]/[0.04] sm:h-96 sm:w-96 dark:bg-[#C8BCA2]/[0.03]" />

      <div className="gv-paper-content relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-20 sm:px-10 sm:pb-32 sm:pt-28 lg:px-12">
        <header className="mx-auto max-w-5xl text-center">
          <h1 className="gv-accent mt-4 text-4xl font-semibold tracking-wide sm:text-5xl">
            About Groovara
          </h1>
        </header>

        <article className="mx-auto mt-14 max-w-6xl sm:mt-20">
          <section
            id="what-we-are"
            className="scroll-mt-24"
            aria-labelledby="what-we-are-heading"
          >
            <div className="rounded-2xl bg-[#5B4B6E] px-6 py-5 text-center sm:px-8 sm:py-6">
              <h2
                id="what-we-are-heading"
                className="text-3xl font-medium tracking-wide text-[#F4EDDD] sm:text-4xl"
              >
                What We Are
              </h2>
            </div>

            <div className="mt-7 space-y-7 text-left">
              <h3 className="gv-accent text-2xl font-semibold leading-tight sm:text-3xl">
                Groovara is the space where Mixlists are built.
              </h3>

              <p className="text-lg font-medium leading-8 text-foreground sm:text-2xl sm:leading-9">
                People have always used music to say what words alone
                couldn&apos;t. A lullaby. A protest. A love song.
              </p>

              <p className="text-lg font-medium leading-8 text-foreground sm:text-2xl sm:leading-9">
                A Mixlist is more than a collection of songs. It&apos;s a
                message. Like a mixtape, it unfolds one song at a time. You
                don&apos;t know what&apos;s next until it arrives, and that
                not-knowing is part of the gift. Move one song, and the meaning
                changes.
              </p>
            </div>

            <div className="mt-9 rounded-[1.75rem] border border-[#E8DDC3]/70 bg-[#C8BCA2] px-6 py-7 text-center shadow-sm sm:px-10 sm:py-8 dark:border-[#C8BCA2]/20 dark:bg-[#3A372F]">
              <p className="text-xl font-semibold leading-8 text-[#292923] sm:text-3xl sm:leading-9 dark:text-[#F4EDDD]">
                We work alongside the streaming platforms you already use,
                <br />
                including Spotify, Apple Music, YouTube, and more to come.
                <br />
                They deliver the songs.
              </p>

              <p className="mt-5 text-2xl font-semibold leading-tight text-[#292923] sm:text-4xl dark:text-[#F4EDDD]">
                We help you deliver what the songs mean.
              </p>
            </div>

            <div className="mt-8 border-b border-border pb-9 text-center sm:mt-10 sm:pb-10">
              <p className="text-lg leading-8 text-foreground sm:text-2xl">
                Every Mixlist begins with one person trying to say something to
                another.
              </p>

              <p className="mt-3 text-lg leading-8 text-foreground sm:text-2xl">
                In the end, that&apos;s all any of us want.
              </p>

              <p className="mt-3 text-3xl font-semibold tracking-wide text-foreground sm:text-4xl">
                To be heard.
              </p>
            </div>
          </section>

          <section

          >
            <div className="border-t border-border pt-14 sm:pt-18">
              <div className="rounded-2xl bg-[#5B4B6E] px-6 py-5 text-center sm:px-8 sm:py-6">
                <h2
                  id="what-we-arent-heading"
                  className="text-3xl font-semibold tracking-wide text-[#F4EDDD] sm:text-4xl"
                >
                  What We Aren&apos;t
                </h2>
              </div>

              <p className="gv-accent mt-6 text-center text-xl font-medium sm:text-2xl">
                Some things are better left out...
              </p>
            </div>

            <div className="mt-12 space-y-10 sm:mt-16 sm:space-y-12">
              <section className="gv-row relative overflow-hidden rounded-[2rem] border border-border px-6 py-9 sm:px-9 sm:py-11">
                <GroovaraRingMark className="-right-20 -top-24 h-72 w-72 rotate-12 bg-[#5B4B6E]/[0.045] dark:bg-[#C8BCA2]/[0.025]" />

                <div className="relative z-10">
                  <h3 className="max-w-5xl text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
                    We are not a social media platform
                  </h3>

                  <div className="mt-7 space-y-5 text-base leading-8 text-foreground/85 sm:text-2xl sm:leading-9">
                    <p>
                      We don&apos;t measure success by how long we can keep you
                      here or how soon we can lure you back. There are no feeds
                      or algorithms engineered to keep you here longer than you
                      want to stay.
                    </p>

                    <p>
                      Your Mixlists can be as public or as private as you&apos;d
                      like, and wherever you choose to share them, we won&apos;t
                      be tracking likes, follower counts, or popularity metrics.
                    </p>

                    <p>What you make here doesn&apos;t have to perform.</p>

                    <p>
                      If this means Groovara stays smaller and quieter than a
                      social platform, that&apos;s not a compromise.
                    </p>

                    <p className="font-medium text-foreground">
                      That&apos;s the point.
                    </p>
                  </div>
                </div>
              </section>

              <section className="gv-row relative overflow-hidden rounded-[2rem] border border-border px-6 py-9 sm:px-9 sm:py-11">
                <GroovaraRingMark className="-left-20 -top-24 h-72 w-72 -rotate-12 bg-[#5B4B6E]/[0.04] dark:bg-[#C8BCA2]/[0.025]" />

                <div className="relative z-10">
                  <h3 className="max-w-5xl text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
                    We are not an ad-supported platform
                  </h3>

                  <div className="mt-7 space-y-5 text-base leading-8 text-foreground/85 sm:text-2xl sm:leading-9">
                    <p>
                      No banners, pop-ups, or sponsored ads interrupting your
                      creative process. Not now. Not ever.
                    </p>

                    <p>
                      This isn&apos;t a minor feature choice. It&apos;s why
                      membership is $5/month. When a product is free,
                      there&apos;s usually a catch. Often, the cost is your
                      attention. We&apos;d rather ask for five dollars and let
                      that be the end of it.
                    </p>

                    <p>
                      There are music lovers who will think $5/month for
                      unlimited Mixlists is a bargain. And others might make one
                      or two a year, just for special occasions.
                    </p>

                    <p>
                      Whatever you decide, monthly, annually, or dropping in when
                      you feel like it, there will be no guilt trips, no endless
                      &quot;we miss you&quot; emails from us.
                    </p>

                    <p className="font-medium text-foreground">
                      That&apos;s not our style.
                    </p>
                  </div>
                </div>
              </section>

              <section className="gv-row relative overflow-hidden rounded-[2rem] border border-border px-6 py-9 sm:px-9 sm:py-11">
                <GroovaraRingMark className="-bottom-20 -right-16 h-72 w-72 rotate-180 bg-[#5B4B6E]/[0.04] dark:bg-[#C8BCA2]/[0.025]" />

                <div className="relative z-10">
                  <h3 className="max-w-5xl text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
                    We are not an AI Mixtape or playlist builder
                  </h3>

                  <div className="mt-7 space-y-5 text-base leading-8 text-foreground/85 sm:text-2xl sm:leading-9">
                    <p>
                      Groovara was constructed by hand, piece by piece. We built
                      it with careful thought about what belongs and what
                      doesn&apos;t.
                    </p>

                    <p>
                      That said, we didn&apos;t ignore AI entirely. We&apos;ve
                      used it ourselves, as a tool, to check code, workshop
                      ideas, and catch typos in copy. But it&apos;s not a
                      substitute for human authorship.
                    </p>

                    <p>
                      AI is <em className="font-medium">not </em> integrated into
                      Groovara itself. It will not choose your songs, decide
                      their order, or write out what they mean to you. If you
                      want to use ChatGPT or Claude to research a song or find
                      the right words for a note, that&apos;s entirely your
                      call.
                    </p>

                    <p className="font-medium text-foreground">
                      But in the end, an algorithm doesn&apos;t equal curation.
                      Good taste does.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
