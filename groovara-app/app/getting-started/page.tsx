import Link from "next/link";
import type { ReactNode } from "react";
import ThemeToggle from "@/lib/ThemeToggle";

export const metadata = {
  title: "Getting Started with Groovara",
  description:
    "Learn what a Mixlist is, how to experience one, and how to create your first Mixlist in Groovara.",
};

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-3xl border border-border bg-card/85 shadow-[0_14px_34px_rgba(40,30,20,0.10)] backdrop-blur-sm dark:shadow-[0_18px_38px_rgba(0,0,0,0.28)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-5 text-left marker:hidden sm:px-7 sm:py-6">
        <span className="text-lg font-semibold leading-snug text-foreground underline decoration-[#5B4B6E]/55 decoration-2 underline-offset-4 sm:text-xl">
          {title}
        </span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#5B4B6E]/25 text-lg font-medium text-[#5B4B6E] transition-transform group-open:rotate-45 dark:border-[#C8BCA2]/25 dark:text-[#C8BCA2]"
        >
          +
        </span>
      </summary>

      <div className="border-t border-border px-5 py-5 text-[15px] leading-7 text-foreground/90 sm:px-7 sm:py-6">
        <div className="space-y-4">{children}</div>
      </div>
    </details>
  );
}

export default function GettingStartedPage() {
  return (
    <main className="gv-paper-bg min-h-screen bg-background text-foreground">
      <div className="gv-paper-content min-h-screen">
        <div className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
          <section className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-[0.28em] text-[#5B4B6E] dark:text-[#C8BCA2]">
              GROOVARA BETA GUIDE
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Getting Started with Groovara
            </h1>
            <div className="mx-auto mt-6 max-w-2xl space-y-3 text-base leading-7 text-muted-foreground">
              <p>
                Groovara is still in beta, which means some things may change,
                some things may be a little rough around the edges, and your
                experience can help us make it better.
              </p>
              <p>This guide will walk you through the basics.</p>
            </div>
          </section>

          <section
            className="mx-auto mt-10 max-w-3xl space-y-4"
            aria-label="Getting started topics"
          >
            <GuideSection title="First, what is a Mixlist?">
              <p>
                A Mixlist is a collection of songs arranged in a specific
                order, to create an experience for someone else.
              </p>
              <p>
                Instead of seeing every song at once, the recipient experiences
                the Mixlist one song at a time. You can include an opening
                message, personal notes about individual songs, and a closing
                message that brings everything together.
              </p>
              <p>
                The songs may come from different music platforms. The sequence
                and the meaning behind them live on Groovara.
              </p>
            </GuideSection>

            <GuideSection title="Your music platform does not have to match theirs">
              <p>
                A Mixlist is not tied to one music service. You might create
                and share it using songs from one platform, while the recipient
                experiences those songs through another. For example, a Mixlist
                created using Spotify can be experienced through YouTube or
                Apple Music when matching versions are available.
              </p>
              <p>
                For your first Mixlist, we recommend starting with YouTube. It
                is the most widely accessible option and gives recipients the
                best chance of experiencing your Mixlist even if they do not
                subscribe to the same music service you use.
              </p>
            </GuideSection>

            <GuideSection title="If someone shared a Mixlist with you">
              <p>
                You do not need a Groovara account or beta code to experience a
                public Mixlist.
              </p>
              <ol className="ml-5 list-decimal space-y-1.5 pl-2">
                <li>Open the link or scan the QR code you received.</li>
                <li>Read the opening message.</li>
                <li>
                  Select <strong>Reveal First Song</strong>.
                </li>
                <li>
                  Choose an available music service to listen to the song.
                </li>
                <li>
                  Return to the Mixlist to read the note and reveal the next
                  song.
                </li>
                <li>
                  Continue in order until you reach the closing message.
                </li>
              </ol>
              <p>
                Mixlists are designed to unfold in sequence, so try not to skip
                ahead. The order is part of the story.
              </p>
            </GuideSection>

            <GuideSection title="Joining Groovara’s beta">
              <p>If you received a beta code:</p>
              <ol className="ml-5 list-decimal space-y-1.5 pl-2">
                <li>
                  Go to <Link className="gv-accent underline" href="/">Groovara.com</Link>.
                </li>
                <li>
                  Select <strong>Enter Code</strong>.
                </li>
                <li>Enter your beta code when prompted.</li>
                <li>Create an account or sign in.</li>
                <li>Follow the prompts to enter Groovara.</li>
              </ol>
              <p>
                If you do not have a beta code, select{" "}
                <Link className="gv-accent font-semibold underline" href="/access">
                  Request Beta Access
                </Link>{" "}
                and complete the short form. We are inviting new testers in
                small groups while Groovara is still being built.
              </p>
            </GuideSection>

            <GuideSection title="Creating your first Mixlist">
              <p>
                A Mixlist does not need to be long or elaborate. Five to ten
                songs is a good place to begin.
              </p>

              <div className="space-y-2">
                <h2 className="font-semibold">1. Begin a new Mixlist</h2>
                <p>Select the option to create a new Mixlist.</p>
                <p>
                  Give it a title that helps the recipient understand what the
                  Mixlist is about. It could be connected to a person, memory,
                  experience, place, celebration, or story.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">2. Write an opening message</h2>
                <p>
                  The opening message introduces the Mixlist before the first
                  song is revealed.
                </p>
                <p>You might explain:</p>
                <ul className="ml-5 list-disc space-y-1.5 pl-2">
                  <li>Why you made it</li>
                  <li>Who or what it is about</li>
                  <li>What you hope the recipient hears in it</li>
                  <li>
                    Whether the songs tell a story or follow a particular theme
                  </li>
                </ul>
                <p>This can be as brief or as personal as you want.</p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">3. Add your songs</h2>
                <p>
                  Search for songs within Groovara or use the available import
                  options.
                </p>
                <p>
                  As you add songs, place them in the order in which you want
                  them experienced. Sequence matters. Think about where the
                  story begins, how it develops, and where you want it to end.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">4. Add notes</h2>
                <p>
                  You can add a note explaining why you chose a particular song
                  or what it means within the Mixlist.
                </p>
                <p>
                  You do not have to explain everything. A note can be a
                  complete story, a single sentence, an inside joke, a memory,
                  or simply a few words that give the song context.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">
                  5. Finish and personalize your Mixlist
                </h2>
                <p>
                  At the bottom of the draft page, you can add the final details
                  that shape how your Mixlist will appear and be experienced.
                </p>
                <p>
                  Enter a Recipient Name and Sender Name if they apply. These
                  can be displayed as “Mixlist for…” and “From…” when the
                  Mixlist is published.
                </p>
                <p>
                  You can also write a Closing Note, which appears only after
                  the final song has been revealed. Use it to complete the
                  thought, return to something from the opening, or leave the
                  recipient with one final message.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">6. Choose your Mixlist options</h2>
                <p>Select the options you want to include:</p>
                <ul className="ml-5 list-disc space-y-1.5 pl-2">
                  <li>
                    <strong>Show Recipient:</strong> Displays the recipient’s
                    name as “Mixlist for…”
                  </li>
                  <li>
                    <strong>Show Sender:</strong> Displays the sender’s name as
                    “From…”
                  </li>
                  <li>
                    <strong>Show Date:</strong> Displays the date the Mixlist
                    was published.
                  </li>
                  <li>
                    <strong>Reveal Mode:</strong> Presents the songs one at a
                    time, in the order you arranged them.
                  </li>
                  <li>
                    <strong>Include Song Notes:</strong> Displays any notes you
                    added to individual songs.
                  </li>
                  <li>
                    <strong>Public:</strong> Allows anyone with the Mixlist link
                    to experience it.
                  </li>
                  <li>
                    <strong>Allow Recipient to Copy to Studio:</strong> Allows a
                    Groovara user to copy the Mixlist into their own Studio.
                  </li>
                </ul>
                <p>
                  You can turn these options on or off depending on the kind of
                  Mixlist you are creating. A Mixlist made for one person may
                  include the recipient and sender names, while a Mixlist
                  exploring a subject or musical connection may not need them.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">7. Review and publish</h2>
                <p>Before publishing, check that:</p>
                <ul className="ml-5 list-disc space-y-1.5 pl-2">
                  <li>The songs are in the intended order</li>
                  <li>The correct versions of the songs are included</li>
                  <li>
                    Your opening, song, and closing notes appear where you want
                    them
                  </li>
                  <li>
                    The recipient, sender, date, and sharing options are set
                    correctly
                  </li>
                </ul>
                <p>
                  When everything is ready, select{" "}
                  <strong>Publish Mixlist</strong>.
                </p>
                <p>
                  Groovara will open the completed Mixlist so you can see it
                  exactly as your recipients will.
                </p>
                <ul className="ml-5 list-disc space-y-1.5 pl-2">
                  <li>
                    If everything looks right, select <strong>Copy Link</strong>{" "}
                    and share the link.
                  </li>
                  <li>
                    If you need to make changes, select{" "}
                    <strong>Copy to Studio</strong>. This creates a new editable
                    copy in your Studio and automatically adds “(Studio Copy)”
                    to the title. Remove that wording from the title, make your
                    changes, and publish the revised Mixlist.
                  </li>
                </ul>
                <p>
                  Anyone with the link can experience a public Mixlist without
                  creating an account. A beta code is only needed if the
                  recipient wants to join Groovara and create Mixlists of their
                  own.
                </p>
              </div>
            </GuideSection>

            <GuideSection title="A few things to know">
              <div className="space-y-2">
                <h2 className="font-semibold">Groovara works in your browser</h2>
                <p>
                  Groovara is currently a web app, not a downloadable mobile
                  app. It can be opened in a browser on a phone, tablet, or
                  computer and is optimized for use on a phone.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">Groovara does not host the music</h2>
                <p>
                  Songs still play through services such as YouTube, Spotify,
                  or Apple Music. Groovara holds the sequence, notes, and
                  experience surrounding those songs.
                </p>
                <p>
                  Because music availability varies between platforms and
                  regions, an occasional song or version may not be available
                  to every recipient.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-semibold">
                  This is not an ordinary playlist
                </h2>
                <p>
                  A playlist gives someone a group of songs. A Mixlist adds
                  pacing, sequence, context, and personal meaning.
                </p>
                <p>The songs do not change. The experience does.</p>
              </div>
            </GuideSection>

            <GuideSection title="Thank You for Building Groovara With Us">
              <p>
                Groovara is still taking shape, and we truly couldn’t do this
                without you. You do not need to deliberately search for
                problems. Simply use Groovara as naturally as you can and tell
                us what works, what doesn’t, and what leaves you wondering.
              </p>

              <p>The most useful feedback includes:</p>
              <ul className="ml-5 list-disc space-y-1.5 pl-2">
                <li>Anything you did not understand</li>
                <li>Anything you expected to happen differently</li>
                <li>A button or feature you could not find</li>
                <li>A song that would not open or played the wrong version</li>
                <li>
                  A page that froze, displayed incorrectly, or produced an
                  error
                </li>
                <li>Something that felt unnecessarily difficult</li>
                <li>Something you wanted to do but could not</li>
              </ul>

              <p>When reporting a problem, please include:</p>
              <ul className="ml-5 list-disc space-y-1.5 pl-2">
                <li>What you were trying to do</li>
                <li>What happened</li>
                <li>Whether you were using a phone, tablet, or computer</li>
                <li>Your browser, if you know it</li>
                <li>A screenshot of the problem, when possible</li>
              </ul>

              <p>
                Send feedback or questions to{" "}
                <a
                  className="gv-accent font-semibold underline"
                  href="mailto:hello@groovara.com"
                >
                  hello@groovara.com
                </a>
                .
              </p>

              <p>
                Thank you, truly, for helping us build Groovara. This started
                with a simple belief: music helps us remember, connect, and
                express the things we cannot always put into words. The fact
                that you’re willing to spend your time helping us make it real
                means more to us than you know.
              </p>
            </GuideSection>
          </section>

          <section className="mx-auto mt-10 flex max-w-3xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/access"
              className="rounded-full bg-[#5B4B6E] px-6 py-3 text-center text-sm font-semibold tracking-[0.06em] text-[#F4EDDD] transition hover:bg-[#493B59] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Request Beta Access
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-border bg-card px-6 py-3 text-center text-sm font-semibold tracking-[0.06em] text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign In
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
