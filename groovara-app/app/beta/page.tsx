import Link from "next/link";

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

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card/80 px-8 py-12 shadow-xl backdrop-blur md:px-12 md:py-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Early Access
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
            Welcome to Groovara Beta
          </h1>

          <p className="mt-3 text-xl font-light text-foreground/90 md:text-2xl">
            You&apos;re early. We appreciate that.
          </p>

          <div className="mt-8 space-y-4 text-base leading-7 text-foreground/85">
            <p>This is the early build of Groovara.</p>
            <p>It&apos;s not polished. It&apos;s not finished. But it&apos;s alive.</p>
            <p>
              Groovara is built for people who believe music is more than
              background noise. It&apos;s memory, intention, and connection.
              This beta is your chance to explore, create, and help shape what
              this becomes.
            </p>
          </div>

          <div className="my-8 h-px w-full bg-border" />

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Already have access? Log in.</p>
            <p>New here? You&apos;ll need a code to get in.</p>
          </div>

          {code ? (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">
                Invite Code Detected
              </p>
              <p className="mt-2 text-sm font-medium tracking-wide text-foreground">
                {code}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-purple-500/50 bg-purple-500/15 px-6 py-3 text-sm font-medium tracking-wide text-purple-300 transition hover:bg-purple-500/25"
            >
              Log In
            </Link>

            <Link
              href={enterBetaHref}
              className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-medium tracking-wide text-foreground transition hover:bg-background"
            >
              Enter Beta
            </Link>
          </div>

          <p className="mt-10 text-xs text-muted-foreground">
            You didn&apos;t just find this.
            <br />
            You belong here.
          </p>
        </div>
      </div>
    </main>
  );
}