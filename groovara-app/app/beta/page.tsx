import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Early Access | Groovara",
  description:
    "Welcome to Groovara early access—a place for people who live inside music.",
};

function DecorativeRings({
  className,
}: {
  className: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${className}`}
    >
      <span className="absolute inset-0 rounded-full border-[3px] border-[#57577F]/[0.055] dark:border-[#CED7DF]/[0.045]" />
      <span className="absolute inset-[1.15rem] rounded-full border-[3px] border-[#57577F]/[0.055] dark:border-[#CED7DF]/[0.045]" />
      <span className="absolute inset-[2.3rem] rounded-full border-[3px] border-[#57577F]/[0.055] dark:border-[#CED7DF]/[0.045]" />
    </div>
  );
}

export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params?.code || "";

  const enterBetaHref = code
    ? `/signup?code=${encodeURIComponent(code)}`
    : "/signup";

  const loginHref = code
    ? `/login?code=${encodeURIComponent(code)}`
    : "/login";

  return (
    <main className="gv-paper-bg relative min-h-screen overflow-hidden text-foreground">
      <DecorativeRings className="-left-24 -top-20 h-72 w-72 sm:-left-16 sm:-top-14 sm:h-80 sm:w-80" />
      <DecorativeRings className="-bottom-20 -right-20 h-60 w-60 sm:-bottom-24 sm:-right-20 sm:h-72 sm:w-72" />

      <div className="gv-paper-content relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16 sm:px-10 sm:py-20">
        <section className="w-full max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Early Access
          </p>

          <h1 className="gv-accent mt-5 text-3xl font-semibold tracking-wide sm:text-4xl">
            Welcome to Groovara
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl font-medium leading-snug text-foreground sm:text-2xl">
            This is a place for people who don&apos;t just listen to music.
            <br className="hidden sm:block" /> They live inside it.
          </p>

          <div className="mx-auto mt-7 max-w-2xl space-y-6 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            <p>
              We&apos;re building something for that. It&apos;s not polished.
              It&apos;s not finished. But it&apos;s alive.
            </p>

            <p>
              If you&apos;re curious, you&apos;re already the right kind of
              person.
            </p>

            <p>If you have a code, you already know what to do.</p>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={loginHref}
              className="inline-flex min-w-32 items-center justify-center rounded-full border border-[#57577F] bg-transparent px-7 py-3 text-sm font-medium text-[#3d3150] transition hover:-translate-y-0.5 hover:bg-[#57577F]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/35 dark:border-purple-300/60 dark:text-purple-200 dark:hover:bg-purple-300/10 dark:focus-visible:ring-purple-300/35"
            >
              Log in
            </Link>

            <Link
              href={enterBetaHref}
              className="inline-flex min-w-32 items-center justify-center rounded-full border border-[#3f2458] bg-[#3f2458] px-7 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(63,36,88,0.16)] transition hover:-translate-y-0.5 hover:bg-[#4b2b68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/40 dark:border-purple-300/70 dark:bg-purple-300 dark:text-[#1b1022] dark:hover:bg-purple-200 dark:focus-visible:ring-purple-300/40"
            >
              Enter code
            </Link>
          </div>

          <div className="mt-5">
            <p className="text-base text-muted-foreground sm:text-lg">
              Don&apos;t have a code yet?
            </p>

            <Link
              href="/access"
              className="mt-4 inline-flex min-w-40 items-center justify-center rounded-full border border-[#57577F]/70 bg-[#57577F]/10 px-7 py-3 text-sm font-medium text-[#3d3150] transition hover:-translate-y-0.5 hover:bg-[#57577F]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/35 dark:border-purple-300/45 dark:bg-purple-300/10 dark:text-purple-200 dark:hover:bg-purple-300/15 dark:focus-visible:ring-purple-300/35"
            >
              Request beta access
            </Link>
          </div>

          <div className="mx-auto mt-9 max-w-xl border-t border-border pt-6">
            <p className="text-sm text-muted-foreground sm:text-base">
              Got questions? So do we.{" "}
              <a
                href="mailto:hello@groovara.com"
                className="transition hover:text-[#57577F] dark:hover:text-purple-200"
              >
                hello@groovara.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
