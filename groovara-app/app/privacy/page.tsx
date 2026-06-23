import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-24 text-foreground">
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/80 p-8 shadow-lg">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Groovara Legal
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Groovara Privacy Policy
        </h1>

        <p className="mb-8 text-sm text-muted-foreground">
          Effective Date: June 23, 2026
        </p>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <div className="space-y-4">
            <p>
              Groovara respects your
              privacy and is committed to being transparent about how we collect,
              use, store, and share information.
            </p>
            <p>
              This Privacy Policy describes the information Groovara collects,
              how we use it, and the choices available to users of our platform.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              YouTube API Services
            </h2>
            <p>
              Groovara uses YouTube API Services. By using features that access or
              display YouTube content, you acknowledge that YouTube may collect
              and process information in accordance with its own policies and
              terms.
            </p>
            <p>
              Google&apos;s Privacy Policy is available at:{" "}
              <a
                href="https://www.google.com/policies/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#57577F] underline underline-offset-4"
              >
                https://www.google.com/policies/privacy
              </a>
            </p>
            <p>
              YouTube content displayed within Groovara may be subject to
              additional terms, policies, and restrictions established by
              YouTube.
            </p>
            <p>
              Users can learn more about managing their Google privacy settings at
              Google&apos;s privacy controls.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Information We Collect
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 font-medium text-foreground">
                  Account Information
                </h3>
                <p>
                  When you create an account, Groovara may collect and store
                  information such as:
                </p>
                <ul className="mt-3 space-y-2 pl-6 list-disc">
                  <li>Email address</li>
                  <li>User ID or account identifier</li>
                  <li>Account creation information</li>
                  <li>Login and session metadata</li>
                  <li>Beta access or redemption status, where applicable</li>
                </ul>
                <p className="mt-3">
                  If you sign in using Google, Groovara and its authentication
                  providers may receive information associated with your Google
                  account, including:
                </p>
                <ul className="mt-3 space-y-2 pl-6 list-disc">
                  <li>Name or display name</li>
                  <li>Profile image or avatar URL</li>
                  <li>Google provider identifier</li>
                  <li>Email address</li>
                </ul>
                <p className="mt-3">
                  Authentication services are provided through Supabase Auth.
                  Groovara does not store user passwords directly in its
                  application database and does not have access to users'
                  plain-text passwords. Email/password authentication and
                  Google sign-in are handled securely through Supabase Auth.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-foreground">User Content</h3>
                <p>Groovara stores content created and submitted by users, including:</p>
                <ul className="mt-3 space-y-2 pl-6 list-disc">
                  <li>Tracklists</li>
                  <li>Studio drafts</li>
                  <li>Mixlists</li>
                  <li>Song order and sequence information</li>
                  <li>Song notes</li>
                  <li>Mixlist messages</li>
                  <li>Finishing notes</li>
                  <li>Hidden and reveal mode settings</li>
                  <li>Reveal progress information</li>
                  <li>Draft or unfinished content</li>
                  <li>Platform preferences and settings</li>
                  <li>Feedback messages submitted through the platform</li>
                  <li>Shareable mixlist links and identifiers</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-foreground">YouTube Data</h3>
                <p>
                  When users interact with YouTube-powered features, Groovara may
                  access, collect, store, or process information obtained through
                  YouTube API Services, including:
                </p>
                <ul className="mt-3 space-y-2 pl-6 list-disc">
                  <li>YouTube video IDs</li>
                  <li>YouTube URLs</li>
                  <li>Video titles</li>
                  <li>Channel or creator names</li>
                  <li>Thumbnail images</li>
                  <li>Platform source information</li>
                  <li>Search results returned by the YouTube API</li>
                  <li>Conversion or matching results</li>
                  <li>Cached metadata and related API data</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-foreground">
                  Spotify and Apple Music Data
                </h3>
                <p>
                  When users interact with Spotify or Apple Music content, Groovara
                  may access, collect, store, or process information including:
                </p>
                <ul className="mt-3 space-y-2 pl-6 list-disc">
                  <li>Track and song titles</li>
                  <li>Artist names</li>
                  <li>Album names</li>
                  <li>Track URLs</li>
                  <li>Platform source information</li>
                  <li>Provider track identifiers</li>
                  <li>Artwork and album images</li>
                  <li>Search results</li>
                  <li>Conversion or matching results</li>
                  <li>Cached metadata</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Cookies and Similar Technologies
            </h2>
            <p>
              Groovara uses or may use cookies, local storage, session storage, and
              similar technologies.
            </p>
            <p>These technologies may be used for:</p>
            <ul className="mt-3 space-y-2 pl-6 list-disc">
              <li>Authentication and account security</li>
              <li>Session management</li>
              <li>Keeping users signed in</li>
              <li>User preferences and settings</li>
              <li>Theme preferences such as light or dark mode</li>
              <li>Security and abuse prevention</li>
              <li>Performance monitoring</li>
              <li>Analytics and product improvement</li>
              <li>Embedded content and third-party integrations</li>
            </ul>
            <p>
              Third-party services used by Groovara may also place or access
              cookies or similar technologies in accordance with their own
              policies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Analytics
            </h2>
            <p>
              Groovara currently uses Vercel Analytics and may use similar
              analytics services to understand platform usage, site performance,
              traffic patterns, product functionality, and service reliability.
            </p>
            <p>
              Analytics information is used to improve the user experience,
              identify technical issues, and guide product development.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Third-Party Content and Advertising
            </h2>
            <p>
              Groovara integrates with third-party services including YouTube,
              Spotify, Apple Music, Supabase, Vercel, and other service providers
              that support platform functionality.
            </p>
            <p>
              Content displayed through these services may be provided directly by
              those third parties and may be subject to their own terms, policies,
              and privacy practices.
            </p>
            <p>
              Groovara does not currently display or serve third-party advertising.
              If Groovara introduces advertising or additional third-party content
              providers in the future, this Privacy Policy will be updated
              accordingly.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              How We Use Information
            </h2>
            <p>Groovara uses collected information to:</p>
            <ul className="mt-3 space-y-2 pl-6 list-disc">
              <li>Create and manage user accounts</li>
              <li>Authenticate users</li>
              <li>Store and display mixlists and listening experiences</li>
              <li>Save user-created content</li>
              <li>Deliver platform functionality</li>
              <li>Enable sharing features</li>
              <li>Support music platform integrations</li>
              <li>Improve product features and usability</li>
              <li>Analyze platform performance</li>
              <li>Protect the security and integrity of the service</li>
              <li>Respond to user inquiries and feedback</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              How We Share Information
            </h2>
            <p>Groovara does not sell personal information.</p>
            <p>
              We may share information with service providers and partners that
              help us operate the platform, including:
            </p>
            <ul className="mt-3 space-y-2 pl-6 list-disc">
              <li>Supabase</li>
              <li>Vercel</li>
              <li>YouTube API Services</li>
              <li>Spotify</li>
              <li>Apple Music</li>
              <li>Analytics providers</li>
              <li>Other infrastructure or service providers required to operate Groovara</li>
            </ul>
            <p>
              Information may also be disclosed when required by law, legal
              process, or to protect the rights, safety, security, or integrity of
              Groovara and its users.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Data Retention
            </h2>
            <p>
              Groovara retains information for as long as reasonably necessary to
              operate the service, comply with legal obligations, resolve disputes,
              maintain security, and enforce agreements.
            </p>
            <p>Retention periods may vary depending on the type of information involved.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Data Deletion Requests
            </h2>
            <p>
              Users may request deletion of their account information or
              user-created content by contacting Groovara.
            </p>
            <p>
              Subject to legal, security, fraud-prevention, abuse-prevention, and
              operational requirements, Groovara will delete or de-identify
              information associated with the request.
            </p>
            <p>Requests may be submitted to: hello@groovara.com</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              YouTube Data Refresh and Maintenance
            </h2>
            <p>
              To help maintain accuracy and compliance with YouTube API
              requirements, Groovara refreshes, updates, or deletes stored YouTube
              API data at least every 30 calendar days.
            </p>
            <p>
              When YouTube-related content is accessed and stored metadata is
              outdated, Groovara may retrieve updated information from YouTube API
              Services, update stored records, or remove unavailable information
              when content is no longer available through YouTube.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When material
              changes are made, the updated version will be posted with a revised
              Effective Date.
            </p>
            <p>
              Continued use of Groovara after changes become effective constitutes
              acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Contact Information
            </h2>
            <p>
              Questions, privacy requests, account inquiries, or data deletion
              requests may be directed to:
            </p>
            <p className="font-medium text-foreground">GROOVARA LLC</p>
            <p>hello@groovara.com</p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/terms"
            className="rounded-full border border-[#57577F]/20 px-4 py-2 text-sm text-[#57577F] hover:bg-[#57577F]/10"
          >
            Terms of Use
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
