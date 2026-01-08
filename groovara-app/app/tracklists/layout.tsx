import Link from "next/link";
import type { ReactNode } from "react";
import { Protected } from "../../lib/Protected";

export default function TracklistsLayout({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <div className="min-h-screen bg-[#0b0a0f] text-gray-200">
        <header className="flex items-center justify-between px-10 py-6">
        </header>

        {children}
      </div>
    </Protected>
  );
}
