import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Use | Groovara",
  description: "Terms governing access to and use of Groovara.",
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

export default function TermsPage() {
  return (
    <main className="gv-paper-bg min-h-screen px-6 py-24 text-foreground">
      <div className="gv-paper-content mx-auto max-w-3xl rounded-3xl border border-border bg-card/85 p-8 shadow-lg sm:p-10">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Groovara Legal
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Groovara Terms of Use
        </h1>

        <p className="mb-8 text-sm text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>

        <div className="space-y-9 text-sm leading-7 text-muted-foreground">
          <div className="space-y-4">
            <p>Welcome to Groovara.</p>
            <p>
              These Terms of Use (&quot;Terms&quot;) govern your access to and
              use of the Groovara website, beta platform, Tracklists, Mixlists,
              Studio, playlist import and export tools, music-platform
              integrations, and related services provided by GROOVARA LLC
              (&quot;Groovara,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;).
            </p>
            <p>
              By creating an account, accepting these Terms, or using Groovara,
              you agree to these Terms and the{" "}
              <Link
                href="/privacy"
                className="font-medium text-[#57577F] underline underline-offset-4 dark:text-purple-300"
              >
                Privacy Policy
              </Link>
              . If you do not agree, do not use Groovara.
            </p>
          </div>

          <Section title="Eligibility and Beta Access">
            <p>
              You must be legally capable of agreeing to these Terms. If you are
              under the age of legal majority where you live, you may use
              Groovara only with permission from a parent or legal guardian.
              Groovara is not intended for children under 13.
            </p>
            <p>
              Certain features may require a beta code, invitation, connected
              music account, paid third-party subscription, or other eligibility
              requirement. Beta access may be limited, modified, or withdrawn at
              any time.
            </p>
          </Section>

          <Section title="About Groovara">
            <p>
              Groovara helps users create, organize, import, share, experience,
              and export music-based collections, Tracklists, Mixlists, notes,
              messages, and related content across supported music services.
            </p>
            <p>
              Groovara does not host the underlying music recordings and does not
              grant rights to reproduce, distribute, publicly perform, or
              otherwise exploit music or third-party content.
            </p>
          </Section>

          <Section title="User Accounts">
            <p>
              You are responsible for maintaining the confidentiality and
              security of your account, devices, and login credentials, and for
              activity performed through your account. You agree to provide
              accurate information and promptly notify Groovara of suspected
              unauthorized access.
            </p>
            <p>
              Groovara may use rate limits, beta restrictions, security checks,
              and other controls to protect the platform and third-party API
              quotas.
            </p>
          </Section>

          <Section title="Connected Music Accounts">
            <p>
              Some features require you to authorize Groovara through Spotify,
              Google, YouTube, or another supported provider. The provider—not
              Groovara—handles your provider username and password.
            </p>
            <p>
              You authorize Groovara to use the permissions you approve only to
              provide the requested connected features. You may disconnect a
              supported account through Groovara&apos;s settings where available
              or revoke access through the provider.
            </p>
          </Section>

          <Section title="Third-Party Services">
            <p>
              Groovara integrates with third-party services including YouTube,
              Spotify, Apple Music, Supabase, Vercel, and PostHog. Their content,
              accounts, subscriptions, availability, data practices, and actions
              are governed by their own terms and policies.
            </p>
            <p>
              Groovara is not affiliated with, endorsed by, or sponsored by
              YouTube, Spotify, or Apple Music unless expressly stated otherwise.
              Third-party services may change, restrict, remove, or discontinue
              content or functionality without Groovara&apos;s control.
            </p>
          </Section>

          <Section title="YouTube Terms of Service">
            <p>
              Groovara uses YouTube API Services. By using any feature that
              accesses, displays, searches, imports, validates, matches, plays,
              exports, or otherwise interacts with YouTube content, you also agree
              to be bound by the{" "}
              <ExternalLink href="https://www.youtube.com/t/terms">
                YouTube Terms of Service
              </ExternalLink>
              .
            </p>
            <p>
              Google&apos;s collection and use of information is described in the{" "}
              <ExternalLink href="https://policies.google.com/privacy">
                Google Privacy Policy
              </ExternalLink>
              .
            </p>
          </Section>

          <Section title="Playlist Imports, Matching, and Exports">
            <p>
              Groovara may import metadata from public playlists, match songs
              across providers, and create playlists in a connected account when
              you explicitly select an export action.
            </p>
            <p>
              Cross-platform matching is not guaranteed to be exact. Different
              recordings, remasters, live versions, covers, regional catalog
              differences, unavailable videos, and incomplete metadata may cause
              a missing or incorrect match. You are responsible for reviewing an
              imported or exported playlist and correcting it through the
              destination service when needed.
            </p>
            <p>
              By confirming an export, you instruct Groovara to create a playlist
              and add the available matched songs to the selected connected
              service. Groovara may skip unavailable or unresolved songs and may
              provide manual search links or an export of only the songs already
              matched.
            </p>
          </Section>

          <Section title="User Content and Shared Links">
            <p>
              You may create or submit titles, descriptions, Tracklists,
              Mixlists, notes, messages, finishing notes, feedback, and other
              materials (&quot;User Content&quot;). You retain ownership of your
              User Content.
            </p>
            <p>
              You grant GROOVARA LLC a non-exclusive, worldwide, royalty-free,
              sublicensable license to host, store, reproduce, process, display,
              transmit, and distribute User Content only as reasonably necessary
              to operate, secure, improve, and provide Groovara, including
              delivering a shared Mixlist to its recipients.
            </p>
            <p>
              You represent that you have the rights needed to submit User
              Content and that it does not violate law, these Terms, or another
              person&apos;s rights.
            </p>
            <p>
              A Mixlist marked public or shared through an access-by-link URL may
              be accessed by anyone who obtains the link. You are responsible for
              choosing what to include and who receives the link.
            </p>
          </Section>

          <Section title="Feedback">
            <p>
              If you provide ideas, bug reports, suggestions, or other feedback,
              you grant Groovara permission to use that feedback without
              restriction or compensation, provided that we do not publicly
              identify you as its source without permission.
            </p>
          </Section>

          <Section title="Acceptable Use">
            <p>You agree not to:</p>
            <BulletList>
              <li>Violate any applicable law, regulation, or third-party terms</li>
              <li>Infringe copyrights, trademarks, privacy rights, or other rights</li>
              <li>Upload or share unlawful, abusive, deceptive, or malicious content</li>
              <li>Attempt unauthorized access to accounts, databases, APIs, or systems</li>
              <li>Interfere with Groovara&apos;s security, operation, or availability</li>
              <li>Introduce malware, harmful code, or automated abuse</li>
              <li>Scrape third-party music services or use undocumented provider APIs</li>
              <li>Circumvent rate limits, authorization controls, beta restrictions, or API quotas</li>
              <li>Automate views, playlist actions, or provider activity without valid user direction</li>
              <li>Misrepresent Groovara, impersonate another person, or use Groovara for fraud</li>
            </BulletList>
          </Section>

          <Section title="Groovara Intellectual Property">
            <p>
              Groovara, including its software, visual design, branding, logos,
              documentation, and original content, is owned by GROOVARA LLC or its
              licensors and is protected by intellectual-property laws.
            </p>
            <p>
              These Terms do not grant you ownership of Groovara or third-party
              music, artwork, videos, trademarks, or platform content.
            </p>
          </Section>

          <Section title="Service Changes, Availability, and Beta Risks">
            <p>
              Groovara is under active development. Features may contain errors,
              change significantly, be subject to limits, or stop working.
              Groovara may add, modify, suspend, restrict, or discontinue any
              feature or the service at any time.
            </p>
            <p>
              We do not guarantee that links, embeds, imports, conversions,
              exports, cached matches, connected accounts, or third-party content
              will remain available or accurate.
            </p>
            <p>
              You should keep independent copies of important text or information
              you do not want to lose.
            </p>
          </Section>

          <Section title="Suspension and Termination">
            <p>
              Groovara may suspend or terminate access when reasonably necessary
              to protect users, comply with law or provider requirements,
              investigate abuse, address security risks, enforce these Terms, or
              discontinue the service.
            </p>
            <p>
              You may stop using Groovara at any time and may request account or
              data deletion as described in the Privacy Policy. Termination does
              not automatically delete playlists or content stored in a
              third-party music service.
            </p>
          </Section>

          <Section title="Privacy, Cookies, and Analytics">
            <p>
              Groovara&apos;s collection and use of information—including
              authentication cookies, local storage, PostHog product analytics,
              Vercel Web Analytics, embedded-player technologies, and connected
              account data—is described in the{" "}
              <Link
                href="/privacy"
                className="font-medium text-[#57577F] underline underline-offset-4 dark:text-purple-300"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="Disclaimer of Warranties">
            <p>
              GROOVARA IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
              AVAILABLE&quot; BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW,
              GROOVARA DISCLAIMS ALL EXPRESS, IMPLIED, AND STATUTORY WARRANTIES,
              INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, AND
              SECURITY.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              TO THE FULLEST EXTENT PERMITTED BY LAW, GROOVARA LLC AND ITS
              MEMBERS, EMPLOYEES, CONTRACTORS, AND SERVICE PROVIDERS WILL NOT BE
              LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY,
              OR PUNITIVE DAMAGES, OR FOR LOSS OF DATA, PROFITS, GOODWILL, OR
              BUSINESS OPPORTUNITIES, ARISING FROM OR RELATED TO GROOVARA OR
              THIRD-PARTY SERVICES.
            </p>
            <p>
              Nothing in these Terms excludes liability that cannot legally be
              excluded or limited.
            </p>
          </Section>

          <Section title="Changes to These Terms">
            <p>
              We may update these Terms as Groovara changes. The revised Terms
              will display a new Effective Date. Material changes may be
              accompanied by additional notice or a request that you accept the
              updated Terms. Continued use after the updated Terms take effect
              constitutes acceptance to the extent permitted by law.
            </p>
          </Section>

          <Section title="Contact Information">
            <p>Questions about these Terms may be directed to:</p>
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
            href="/privacy"
            className="rounded-full border border-[#57577F]/25 px-4 py-2 text-sm text-[#57577F] transition hover:bg-[#57577F]/10 dark:text-purple-300"
          >
            Privacy Policy
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
