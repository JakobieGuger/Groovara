import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-24 text-foreground">
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/80 p-8 shadow-lg">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Groovara Legal
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Groovara Terms of Use
        </h1>

        <p className="mb-8 text-sm text-muted-foreground">
          Effective Date: June 23, 2026
        </p>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <div className="space-y-4">
            <p>Welcome to Groovara.</p>
            <p>
              These Terms govern your access to and use of the
              Groovara platform and services provided by GROOVARA LLC. 
              By accessing or using Groovara, you agree to these Terms.
            </p>
            <p>
              If you do not agree to these Terms, please do not use Groovara.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              About Groovara
            </h2>
            <p>
              Groovara is a platform that allows users to create, organize, share,
              and experience music-based collections, mixlists, playlists, notes,
              messages, and related content across supported music services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Third-Party Services
            </h2>
            <p>
              Groovara integrates with third-party services, including YouTube,
              Spotify, and Apple Music. Content made available through these
              services remains subject to the terms, policies, availability, and
              restrictions established by those providers.
            </p>
            <p>
              Users who access Spotify or Apple Music content through Groovara are
              responsible for complying with the applicable terms and policies of
              those services.
            </p>
            <p>
              Groovara is not affiliated with, endorsed by, or sponsored by
              YouTube, Spotify, or Apple Music unless expressly stated otherwise.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              YouTube Terms of Service
            </h2>
            <p>
              Groovara uses YouTube API Services. Certain content displayed within
              Groovara is provided through YouTube API Services.
            </p>
            <p>
              By using any Groovara feature that accesses, displays, searches,
              retrieves, or interacts with YouTube content, you agree to be bound
              by the YouTube Terms of Service, available at:{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#57577F] underline underline-offset-4"
              >
                https://www.youtube.com/t/terms
              </a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              User Accounts
            </h2>
            <p>
              You may be required to create an account to access certain features
              of Groovara. You are responsible for maintaining the security of your
              account credentials and for all activity that occurs under your
              account.
            </p>
            <p>
              You agree to provide accurate information and to keep your account
              information current.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              User Content
            </h2>
            <p>
              Users may create and submit content including mixlists, playlists,
              notes, messages, descriptions, comments, and other materials (User Content).
            </p>
            <p>
              You retain ownership of your User Content. By submitting User Content
              to Groovara, you grant GROOVARA LLC a non-exclusive, worldwide,
              royalty-free license to store, display, process, and distribute such
              content solely for the purpose of operating and improving the
              service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="mt-3 space-y-2 pl-6 list-disc">
              <li>Violate any applicable law or regulation.</li>
              <li>Attempt to gain unauthorized access to Groovara systems or accounts.</li>
              <li>Interfere with the operation, security, or integrity of the service.</li>
              <li>Infringe upon the intellectual property rights of others.</li>
              <li>Misuse content obtained through third-party services.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Availability of Service
            </h2>
            <p>
              Groovara may modify, suspend, discontinue, or remove features at any
              time without prior notice.
            </p>
            <p>
              Third-party music services may independently modify, restrict, or
              remove content, which may affect the availability of certain
              features within Groovara.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Disclaimer of Warranties
            </h2>
            <p>Groovara is provided on an as is and as available basis.</p>
            <p>
              To the fullest extent permitted by law, GROOVARA LLC disclaims all
              warranties, express or implied, including warranties of
              merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, GROOVARA LLC shall not be
              liable for any indirect, incidental, consequential, special, or
              punitive damages arising from or relating to the use of Groovara.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. Continued use of
              Groovara after changes become effective constitutes acceptance of the
              updated Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Contact Information
            </h2>
            <p>Questions regarding these Terms may be directed to:</p>
            <p className="font-medium text-foreground">GROOVARA LLC</p>
            <p>hello@groovara.com</p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="rounded-full border border-[#57577F]/20 px-4 py-2 text-sm text-[#57577F] hover:bg-[#57577F]/10"
          >
            Privacy Policy
          </Link>

          <Link
            href="/hub"
            className="rounded-full bg-[#57577F] px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Back to Groovara
          </Link>
        </div>
      </div>
    </main>
  );
}
