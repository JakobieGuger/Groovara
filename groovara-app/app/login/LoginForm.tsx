"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";

const initialState = {
  error: "",
};

type LoginFormProps = {
  next: string;
  codeFromUrl: string;
};

export default function LoginForm({
  next,
  codeFromUrl,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  const signInWithGoogle = () => {
    const params = new URLSearchParams();

    if (next) params.set("next", next);
    if (codeFromUrl) params.set("code", codeFromUrl);

    const query = params.toString();
    window.location.href = query ? `/google?${query}` : "/google";
  };

  const signupParams = new URLSearchParams();

  if (next) signupParams.set("next", next);
  if (codeFromUrl) signupParams.set("code", codeFromUrl);

  const signupHref = `/signup?${signupParams.toString()}`;

  return (
    <main className="gv-paper-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-14rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-12rem] right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-violet-500/10 blur-3xl"
      />

      <div className="gv-paper-content w-full max-w-md">
        <section className="gv-row rounded-3xl p-6 sm:p-8">
          <header className="text-center">
            <p className="text-xs tracking-[0.28em] text-muted-foreground">
              WELCOME BACK
            </p>

            <h1 className="gv-accent mt-3 text-3xl font-semibold tracking-wide">
              Sign in to Groovara
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Create Tracklists, share Mixlists, and keep your music moving
              between platforms.
            </p>
          </header>

          <form action={formAction} className="mt-8 space-y-5">
            <input type="hidden" name="next" value={next} />

            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <label
                  htmlFor="login-password"
                  className="block text-xs uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Password
                </label>

                <Link
                  href="/forget"
                  className="gv-accent text-xs transition"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                className="w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>

            {state?.error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
              >
                {state.error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-xs font-medium tracking-[0.2em] text-purple-800 transition hover:bg-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-purple-200"
            >
              {pending ? "SIGNING IN..." : "SIGN IN"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs tracking-[0.2em] text-muted-foreground">
              OR
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={pending}
            className="w-full rounded-full border border-border bg-background/60 px-6 py-3 text-xs font-medium tracking-[0.18em] text-foreground transition hover:border-purple-500/40 hover:bg-purple-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            CONTINUE WITH GOOGLE
          </button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href={signupHref} className="gv-accent font-medium transition">
              Sign up
            </Link>
          </p>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-center text-[11px] leading-5 text-muted-foreground">
              By signing in, you agree to Groovara&apos;s{" "}
              <Link
                href="/terms"
                className="gv-accent underline underline-offset-4"
              >
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="gv-accent underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              . Groovara uses YouTube API Services, and YouTube-powered
              features are also subject to the{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
                className="gv-accent underline underline-offset-4"
              >
                YouTube Terms of Service
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
