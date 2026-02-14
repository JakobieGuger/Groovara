import Link from "next/link";


export default function HubPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center text-white"
      style={{
        backgroundImage: "url('/gv_HomepageImage.jpg')",
      }}
    >
      {/* Overlay */}
      <div className="min-h-screen bg-black/70 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 pt-28 pb-20">
          
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight">
              Welcome back.
            </h1>
            <p className="mt-3 text-lg text-white/70">
              Start something new, or return to what you’ve been shaping.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-16 grid gap-10 md:grid-cols-2">
            
            {/* Create */}
            <div>
              <p className="mb-4 text-sm uppercase tracking-widest text-white/50">
                Create
              </p>

              <div className="space-y-4">
                <ActionCard
                  title="Start a new Tracklist"
                  subtitle="Shape music for yourself."
                  href="/tracklists/new"
                />
                <ActionCard
                  title="Create a Mixlist"
                  subtitle="Share music with intention."
                  href="/tracklists"
                />
              </div>
            </div>

            {/* Continue */}
            <div>
              <p className="mb-4 text-sm uppercase tracking-widest text-white/50">
                Continue
              </p>

              <div className="space-y-4">
                <ActionCard
                  title="See my Tracklists"
                  subtitle="Your personal listening spaces."
                  href="/tracklists"
                />
                <ActionCard
                  title="See my Mixlists"
                  subtitle="What you’ve shared with others."
                  href="/mixlists"
                />
              </div>
            </div>

          </div>

          {/* Footer */}
          <p className="mt-20 text-center text-sm text-white/50">
            Tracklists stay with you. Mixlists travel.
          </p>
        </div>
      </div>
    </main>
  );
}

function ActionCard({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10"
    >
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{subtitle}</p>
    </Link>
  );
}
