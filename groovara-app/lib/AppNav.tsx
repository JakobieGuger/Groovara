"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./Logout";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

type MenuItem =
  | { type: "link"; label: string; href: string }
  | { type: "divider" }
  | { type: "custom"; node: React.ReactNode };

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const items: MenuItem[] = [
    { type: "link", label: "Home", href: "/" },
    { type: "link", label: "My Tracklists", href: "/tracklists" },
    { type: "link", label: "My Mixlists", href: "/mixlists" }, // add later
    { type: "divider" },
    { type: "link", label: "Settings", href: "/settings" }, // stub
    { type: "link", label: "About", href: "/about" }, // optional stub
    { type: "divider" },
    { type: "custom", node: <LogoutButton /> },
  ];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="h-14 px-5 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10">
        {/* Brand + dropdown */}
        <div ref={wrapRef} className="relative flex items-center gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 select-none"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="tracking-[0.35em] text-sm text-purple-300">
              GROOVARA
            </span>
            <span className="text-white/60 text-xs">▾</span>
          </button>

          {APP_VERSION && (
            <div className="px-3 py-2 text-[10px] tracking-widest text-gray-500 select-none">
              {APP_VERSION}
            </div>
          )}


          {open && (
            <div
              role="menu"
              className="absolute top-12 left-0 w-56 rounded-xl border border-white/10 bg-black/80 backdrop-blur-md shadow-lg overflow-hidden"
            >
              <div className="py-2">
                {items.map((it, idx) => {
                  if (it.type === "divider") {
                    return (
                      <div
                        key={`div-${idx}`}
                        className="my-2 border-t border-white/10"
                      />
                    );
                  }
                  if (it.type === "custom") {
                    return (
                      <div key={`custom-${idx}`} className="px-3 py-1">
                        {it.node}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-white/85 hover:bg-white/10"
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right side: keep intentionally empty for now */}
        <div />
      </div>
    </header>
  );
}
