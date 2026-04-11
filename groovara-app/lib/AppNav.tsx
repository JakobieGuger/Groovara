"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./Logout";
import ThemeToggle from "./ThemeToggle";
import { usePathname } from "next/navigation";
import Image from "next/image";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

type MenuItem =
  | { type: "link"; label: string; href: string }
  | { type: "divider" }
  | { type: "custom"; node: React.ReactNode };

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const items: MenuItem[] = [
    { type: "link", label: "Home", href: "/hub" },
    { type: "link", label: "My Tracklists", href: "/tracklists" },
    { type: "link", label: "My Mixlists", href: "/mixlists" },
    { type: "divider" },
    { type: "link", label: "Settings", href: "/settings" },
    { type: "link", label: "About", href: "/about" },
    {
      type: "link",
      label: "Feedback",
      href: `/feedback?from=${encodeURIComponent(pathname)}`,
    },
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
      {/* Uses globals.css .gv-nav-surface for light cream strip + hairline */}
      <div className="gv-nav-surface h-14 px-5 flex items-center justify-between">
        {/* Brand + dropdown */}
        <div ref={wrapRef} className="relative flex items-center gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 select-none"
            aria-haspopup="menu"
            aria-expanded={open}
          >
              <Image
                src="/groovara-icon.png"
                alt="Groovara logo"
                width={22}
                height={22}
                className="h-[22px] w-[22px]"
              />
            {/* gv-brand-mark adds a subtle charcoal “ink edge” in light mode */}
            <span className="gv-brand-mark tracking-[0.35em] text-sm text-foreground gv-accent">
              GROOVARA
            </span>
            <span className="text-muted-foreground text-xs gv-accent">
              ▾
            </span>
          </button>

          {APP_VERSION && (
            <div className="px-3 py-2 text-[10px] tracking-widest text-muted-foreground/70 select-none dark:text-gray-500">
              {APP_VERSION}
            </div>
          )}

          {open && (
            <div
              role="menu"
              className="absolute top-12 left-0 w-56 overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg dark:border-white/10 dark:bg-black/80"
            >
              <div className="py-2">
                {items.map((it, idx) => {
                  if (it.type === "divider") {
                    return (
                      <div
                        key={`div-${idx}`}
                        className="my-2 border-t border-border/60 dark:border-white/10"
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
                      className="block px-4 py-2 text-sm text-foreground hover:bg-muted/60 dark:text-white/85 dark:hover:bg-white/10"
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}