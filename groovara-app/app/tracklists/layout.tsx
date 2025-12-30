import Link from "next/link";
import type { ReactNode } from "react";
import { Protected } from "../../lib/Protected";

export default function TracklistsLayout({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <div className="min-h-screen bg-[#0b0a0f] text-gray-200">
        <header className="flex items-center justify-between px-10 py-6">
          <Link
            href="/"
            className="text-sm tracking-[0.35em] font-medium text-purple-300"
          >
            GROOVARA
          </Link>

          <nav className="space-x-8 text-xs tracking-widest text-gray-400">
            <Link className="hover:text-purple-300 transition" href="/tracklists">
              TRACKLISTS
            </Link>
            <Link className="hover:text-purple-300 transition" href="/app">
              DASHBOARD
            </Link>
          </nav>
        </header>

        {children}
      </div>
    </Protected>
  );
}
