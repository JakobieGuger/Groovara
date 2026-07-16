import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy | Groovara",
  description:
    "Learn how Groovara collects, uses, stores, and protects information.",
};

const EFFECTIVE_DATE = "July 16, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[#57577F] underline underline-offset-4 transition hover:opacity-75 dark:text-purple-300"
    >
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <main className="gv-paper-bg min-h-screen px-6 py-24 text-foreground">
      <div className="gv-paper-content mx-auto max-w-3xl rounded-3xl border border-border bg-card/85 p-8 shadow-lg sm:p-10">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Groovara Legal
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Groovara Privacy Policy
        </h1>

        <p className="mb-8 text-sm text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>

        <div className="space-y-9 text-sm leading-7 text-muted-foreground">
          <div className="space-y-4">
            <p>
              GROOVARA LLC (&quot;Groovara,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) respects your privacy and is
              committed to being transparent about how information is collected,
              used, stored, and shared.
            </p>
            <p>
              This Privacy Policy applies to the Groovara website, beta platform,
              Tracklists, Mixlists, Studio, music-platform integrations, playlist
              import and export tools, and related services.
            </p>
          </div>

          <Section title="Information We Collect">
            <Subsection title="Account and Authentication Information">
              <p>
                When you create or use a Groovara account, we may process:
              </p>
              <BulletList>
                <li>Email address and user account identifier</li>
                <li>Account creation and login timestamps</li>
                <li>Session and authentication metadata</li>
                <li>Beta access, invite, or redemption status</li>
                <li>Security, rate-limit, and abuse-prevention records</li>
              </BulletList>
              <p>
                Authentication is provided through Supabase Auth. Groovara does
                not store your plain-text password in its application database.
                If you use Google sign-in, Groovara and Supabase may receive your
                email address, display name, profile image, and Google provider
                identifier.
              </p>
            </Subsection>

            <Subsection title="User Content and Listening Activity">
              <p>
                Groovara stores content and activity needed to provide the
                service, including:
              </p>
              <BulletList>
                <li>Tracklists, Studio drafts, and imported playlists</li>
                <li>Mixlists, titles, descriptions, messages, and finishing notes</li>
                <li>Song order, song notes, reveal settings, and visibility settings</li>
                <li>Reveal progress, clicked-song state, and listening progress</li>
                <li>Sent, received, archived, and recently opened Mixlist records</li>
                <li>Platform preferences, theme settings, and feature settings</li>
                <li>Feedback messages and the page from which feedback was submitted</li>
              </BulletList>
              <p>
                Mixlists shared through a public or access-by-link URL may be
                viewed by anyone who obtains that link. Do not place sensitive
                personal information in a Mixlist, message, description, or song
                note that you are not comfortable sharing with its recipients.
              </p>
            </Subsection>

            <Subsection title="Connected Music Accounts and Authorization Data">
              <p>
                When you connect Spotify or YouTube, Groovara may store or process
                OAuth access tokens, refresh tokens, granted scopes, provider
                account or channel identifiers, connection status, and token
                expiration information. These credentials are used only to
                provide the connected features you request, such as importing a
                playlist or creating a playlist in your connected account.
              </p>
              <p>
                Groovara never asks for or stores your Spotify, Google, YouTube, or
                Apple account password. Authentication occurs on the provider&apos;s
                own authorization page.
              </p>
            </Subsection>

            <Subsection title="Music Catalog, Import, Export, and Matching Data">
              <p>
                When you search, import, convert, listen to, or export music,
                Groovara may process:
              </p>
              <BulletList>
                <li>Song, artist, album, channel, and playlist names</li>
                <li>Provider URLs, track IDs, video IDs, playlist IDs, and artwork</li>
                <li>International Standard Recording Codes (ISRCs), when available</li>
                <li>Public search results and platform source information</li>
                <li>Import and export results, counts, errors, and created playlist URLs</li>
                <li>Cached conversion, availability, and validation timestamps</li>
              </BulletList>
              <p>
                Groovara may create reusable track-matching records using an ISRC
                or a normalized title-and-artist identity. These records connect a
                song identity to a provider track or YouTube video and may be
                reused to improve matching for other users. They are intended to
                describe music catalog relationships, not an individual&apos;s
                listening history.
              </p>
            </Subsection>

            <Subsection title="Technical and Usage Information">
              <p>
                Groovara and its service providers may process browser type,
                device type, operating system, page or route viewed, referrer,
                approximate region, event timestamp, feature interactions,
                diagnostic information, and pseudonymous analytics identifiers.
                Server logs may also temporarily process IP addresses and request
                metadata for security, reliability, and abuse prevention.
              </p>
            </Subsection>
          </Section>

          <Section title="YouTube API Services">
            <p>
              Groovara uses YouTube API Services to search for public videos,
              display YouTube content, validate cached video data, import public
              playlists, match songs, and—after a user explicitly chooses to do
              so—create a playlist in the user&apos;s connected YouTube account.
            </p>
            <p>
              Use of YouTube-powered features is also subject to the{" "}
              <ExternalLink href="https://www.youtube.com/t/terms">
                YouTube Terms of Service
              </ExternalLink>
              . Google&apos;s privacy practices are described in the{" "}
              <ExternalLink href="https://policies.google.com/privacy">
                Google Privacy Policy
              </ExternalLink>
              .
            </p>
            <p>
              Groovara does not use YouTube authorization data for unrelated
              advertising, profiling, or surveillance, and does not permit
              unauthorized third parties to access a user&apos;s connected YouTube
              account data.
            </p>
          </Section>

          <Section title="Cookies, Local Storage, and Similar Technologies">
            <p>
              Groovara uses cookies, browser storage, and similar technologies for
              the categories described below.
            </p>

            <div className="space-y-5 rounded-2xl border border-border bg-background/45 p-5">
              <Subsection title="Strictly Necessary">
                <p>
                  Supabase authentication cookies and related security storage are
                  used to keep you signed in, refresh sessions, protect accounts,
                  and provide authenticated features. Disabling these technologies
                  may prevent login or other core features from working.
                </p>
              </Subsection>

              <Subsection title="Preferences and Functionality">
                <p>
                  Local storage or similar browser storage may remember your light
                  or dark theme, preferred listening platform, reveal progress for
                  anonymous sessions, dismissed notices, and other interface
                  preferences.
                </p>
              </Subsection>

              <Subsection title="Analytics and Product Improvement">
                <p>
                  Groovara uses Vercel Web Analytics for aggregated traffic and
                  performance information. Vercel Web Analytics is designed not
                  to use third-party cookies for visitor identification.
                </p>
                <p>
                  Groovara also uses PostHog for product analytics. Depending on
                  Groovara&apos;s configuration and your browser, PostHog may use a
                  first-party cookie, local storage, or another pseudonymous
                  identifier to recognize a browser and associate related product
                  events. Groovara does not intentionally send passwords, OAuth
                  tokens, the text of song notes, or the text of Mixlist messages
                  to analytics providers.
                </p>
              </Subsection>

              <Subsection title="Embedded Music Content">
                <p>
                  YouTube, Spotify, Apple Music, and other embedded players may
                  receive device, network, and interaction information and may set
                  or access their own cookies or similar technologies under their
                  respective privacy policies.
                </p>
              </Subsection>
            </div>

            <p>
              Groovara does not currently use advertising cookies or sell
              information for cross-context behavioral advertising.
            </p>
            <p>
              You can delete or block cookies and local storage through your
              browser settings. Blocking necessary storage may sign you out or
              prevent some features from working. Where consent is required by
              applicable law, Groovara may request consent before enabling
              non-essential analytics or similar technologies.
            </p>
          </Section>

          <Section title="Analytics">
            <p>
              Vercel Web Analytics may process aggregated page views, routes,
              referrers, country or region, browser, device type, operating
              system, and event timestamps for traffic and performance analysis.
            </p>
            <p>
              PostHog may process product events such as opening the Studio,
              creating or publishing a Mixlist, changing a platform, revealing a
              song, copying a link, importing a playlist, or exporting a
              playlist. Event properties may include internal Tracklist or
              Mixlist identifiers, platform names, item counts, and feature
              states.
            </p>
            <p>
              We use analytics to understand whether features work, diagnose
              failures, improve usability, measure beta adoption, and make product
              decisions. We do not sell analytics data.
            </p>
          </Section>

          <Section title="How We Use Information">
            <p>Groovara uses information to:</p>
            <BulletList>
              <li>Create, authenticate, and protect accounts</li>
              <li>Store and display Tracklists, Mixlists, notes, and progress</li>
              <li>Import, search, match, convert, play, share, and export music</li>
              <li>Create playlists in a connected account at the user&apos;s direction</li>
              <li>Remember settings and improve the user experience</li>
              <li>Maintain API compliance, cache freshness, and service reliability</li>
              <li>Prevent fraud, abuse, unauthorized access, and quota misuse</li>
              <li>Analyze product usage and diagnose technical problems</li>
              <li>Respond to support requests, feedback, and legal obligations</li>
            </BulletList>
          </Section>

          <Section title="How We Share Information">
            <p>
              Groovara does not sell personal information. We may disclose
              information to service providers that help operate Groovara,
              including Supabase, Vercel, PostHog, Google and YouTube, Spotify,
              Apple Music, and other infrastructure or integration providers.
            </p>
            <p>
              We may also disclose information when reasonably necessary to comply
              with law or legal process; protect Groovara, users, or the public;
              investigate abuse or security incidents; or complete a business
              transaction such as a merger, financing, acquisition, or sale of
              assets, subject to appropriate safeguards.
            </p>
          </Section>

          <Section title="Connected Account Controls and Revocation">
            <p>
              You may disconnect a supported music account through Groovara&apos;s
              settings when that control is available. Groovara will stop using
              the disconnected authorization and will revoke or remove associated
              credentials and authorized data as required by the provider&apos;s
              rules.
            </p>
            <p>
              You may also revoke Groovara&apos;s Google or YouTube access through{" "}
              <ExternalLink href="https://security.google.com/settings/security/permissions">
                Google&apos;s third-party access settings
              </ExternalLink>
              . Revoking Groovara does not delete playlists or other content
              already stored by YouTube; those items must be managed through
              YouTube.
            </p>
            <p>
              For YouTube Authorized Data, Groovara deletes data as soon as
              reasonably possible and within the periods required by YouTube,
              including after direct revocation, account deletion, or detection
              that authorization can no longer be refreshed.
            </p>
          </Section>

          <Section title="Data Retention and Deletion">
            <p>
              Groovara retains account information and User Content while your
              account is active and for as long as reasonably necessary to provide
              the service, maintain security, resolve disputes, comply with law,
              and enforce agreements.
            </p>
            <p>
              Connected-account credentials are retained only while needed to
              provide an active connection. Public catalog matching records may be
              retained independently of a user account when they do not identify
              an individual and remain useful for platform matching.
            </p>
            <p>
              Stored YouTube API data is refreshed, updated, validated, or deleted
              at least every 30 calendar days where required. Unavailable YouTube
              content may be marked unavailable or removed.
            </p>
            <p>
              You may request deletion of your account information, connected
              authorization data, or User Content by emailing{" "}
              <a
                href="mailto:hello@groovara.com"
                className="font-medium text-[#57577F] underline underline-offset-4 dark:text-purple-300"
              >
                hello@groovara.com
              </a>
              . Some information may be retained when required for security,
              fraud prevention, legal compliance, or to establish or defend legal
              claims.
            </p>
          </Section>

          <Section title="Your Choices and Privacy Rights">
            <p>
              Depending on your location, you may have rights to request access,
              correction, deletion, portability, restriction, or objection
              regarding personal information. You may also withdraw consent where
              processing is based on consent.
            </p>
            <p>
              To exercise a privacy right, contact hello@groovara.com. We may need
              to verify your identity before completing a request. You may also
              manage connected-provider permissions directly through the
              applicable provider.
            </p>
          </Section>

          <Section title="Data Security">
            <p>
              Groovara uses reasonable administrative, technical, and
              organizational safeguards intended to protect information,
              including authenticated access controls, encrypted network
              transport, database access policies, and restricted server-side
              credentials. No internet service can guarantee absolute security.
            </p>
          </Section>

          <Section title="Children&apos;s Privacy">
            <p>
              Groovara is not directed to children under 13, and we do not
              knowingly collect personal information from children under 13. If
              you believe a child has provided personal information, contact us so
              we can review and delete it as appropriate.
            </p>
          </Section>

          <Section title="International Processing">
            <p>
              Groovara and its service providers may process information in the
              United States and other countries. Those countries may have data
              protection laws that differ from the laws where you live.
            </p>
          </Section>

          <Section title="Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy as Groovara changes. The revised
              policy will display a new Effective Date. When required, we may
              provide additional notice or request renewed consent before using
              information in a materially different way.
            </p>
          </Section>

          <Section title="Contact Information">
            <p>
              Questions, complaints, privacy requests, account inquiries, or
              deletion requests may be directed to:
            </p>
            <p className="font-medium text-foreground">GROOVARA LLC</p>
            <p>
              <a
                href="mailto:hello@groovara.com"
                className="font-medium text-[#57577F] underline underline-offset-4 dark:text-purple-300"
              >
                hello@groovara.com
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/terms"
            className="rounded-full border border-[#57577F]/25 px-4 py-2 text-sm text-[#57577F] transition hover:bg-[#57577F]/10 dark:text-purple-300"
          >
            Terms of Use
          </Link>

          <Link
            href="/hub"
            className="rounded-full bg-[#57577F] px-4 py-2 text-sm text-white transition hover:opacity-90"
          >
            Back to Groovara
          </Link>
        </div>
      </div>
    </main>
  );
}
