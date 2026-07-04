"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./Logout";
import ThemeToggle from "./ThemeToggle";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

type MenuItem =
  | {
      type: "link";
      label: string;
      description?: string;
      href: string;
    }
  | { type: "divider" }
  | { type: "custom"; node: ReactNode };

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/hub") return pathname === "/hub" || pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const items: MenuItem[] = [
    {
      type: "link",
      label: "Home",
      description: "Return to the main room",
      href: "/hub",
    },
    {
      type: "link",
      label: "Studio",
      description: "Shape songs, notes, and pacing",
      href: "/tracklists",
    },
    { type: "divider" },
    {
      type: "link",
      label: "Settings",
      description: "Tune your listening preferences",
      href: "/settings",
    },
    {
      type: "link",
      label: "About",
      description: "What is Groovara?",
      href: "/about",
    },
    {
      type: "link",
      label: "Terms",
      description: "Read Groovara’s use terms",
      href: "/terms",
    },
    {
      type: "link",
      label: "Privacy",
      description: "How Groovara handles data",
      href: "/privacy",
    },
    {
      type: "link",
      label: "Feedback",
      description: "Let us know what you think",
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
    <header className="fixed inset-x-0 top-0 z-[2147483646] isolate">
      <div className="gv-nav-surface h-14 px-5 flex items-center justify-between">
        {/* Groovara 3-2 ring motif */}
        <div aria-hidden="true" className="gv-nav-corner-rings" />

        <div ref={wrapRef} className="relative flex items-center gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="group flex select-none items-center gap-3 rounded-full px-1.5 py-1 transition hover:bg-[#57577F]/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/45 dark:hover:bg-white/[0.07] dark:focus-visible:ring-[#CED7DF]/45"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#57577F]/[0.08] ring-1 ring-[#57577F]/15 transition group-hover:bg-[#57577F]/[0.12] dark:bg-white/[0.07] dark:ring-white/10 dark:group-hover:bg-white/[0.11]">
              <Image
                src="/groovara-icon-v2.png"
                alt="Groovara logo"
                width={22}
                height={22}
                className="h-[22px] w-[22px] opacity-90"
                priority
              />
            </span>

            <span className="flex items-baseline gap-2">
              <span className="gv-brand-mark text-[13px] font-semibold tracking-[0.42em] text-[#424266] dark:text-[#CED7DF]">
                GROOVARA
              </span>

              <span className="hidden text-[10px] font-medium tracking-[0.22em] text-[#57577F]/75 dark:text-[#CED7DF]/65 sm:inline">
                beta
              </span>
            </span>

            <span
              aria-hidden="true"
              className={`text-xs text-[#57577F]/80 transition-transform dark:text-[#CED7DF]/75 ${
                open ? "rotate-180" : "rotate-0"
              }`}
            >
              ▾
            </span>
          </button>

          {APP_VERSION && (
            <div className="hidden rounded-full border border-[#57577F]/25 bg-[#57577F]/10 px-3 py-1 text-[10px] tracking-[0.18em] text-[#3f3f63] select-none sm:block dark:border-white/15 dark:bg-white/10 dark:text-[#CED7DF]">
              {APP_VERSION}
            </div>
          )}

          {open && (
            <div
              role="menu"
              className="fixed top-12 left-0 z-[2147483647] w-72 overflow-hidden rounded-r-3xl border border-[#cfc3ad] bg-[#fff8ec]/98 p-3 text-[#24211f] shadow-[0_18px_42px_rgba(64,47,31,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111113]/95 dark:text-white dark:shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
            >
              <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full border-[11px] border-[#57577F]/[0.08] dark:border-[#CED7DF]/[0.07]" />

              <div className="pointer-events-none absolute -left-14 bottom-2 h-28 w-28 rounded-full border-[9px] border-[#57577F]/[0.055] dark:border-[#CED7DF]/[0.045]" />

              <div className="relative py-1">
                {items.map((it, idx) => {
                  if (it.type === "divider") {
                    return (
                      <div
                        key={`div-${idx}`}
                        className="my-2 border-t border-[#57577F]/15 dark:border-white/10"
                      />
                    );
                  }

                  if (it.type === "custom") {
                    return (
                      <div
                        key={`custom-${idx}`}
                        className="rounded-2xl px-2 py-1 text-sm text-[#24211f] dark:text-white
                          [&_button]:w-full
                          [&_button]:rounded-2xl
                          [&_button]:bg-transparent
                          [&_button]:px-4
                          [&_button]:py-3
                          [&_button]:text-left
                          [&_button]:text-sm
                          [&_button]:font-semibold
                          [&_button]:text-[#24211f]
                          [&_button]:transition
                          [&_button]:hover:bg-[#57577F]/12
                          [&_button]:hover:text-[#3f3f63]
                          dark:[&_button]:text-white/85
                          dark:[&_button]:hover:bg-white/10
                          dark:[&_button]:hover:text-white"
                      >
                        {it.node}
                      </div>
                    );
                  }

                  const active = isActive(it.href);

                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={`block rounded-2xl px-4 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#57577F]/35 dark:focus-visible:ring-[#CED7DF]/35 ${
                        active
                          ? "bg-[#57577F] text-[#fff8ec] shadow-[0_10px_26px_rgba(87,87,127,0.24)] dark:bg-[#CED7DF]/15 dark:text-[#CED7DF] dark:shadow-[0_10px_26px_rgba(0,0,0,0.24)]"
                          : "text-[#24211f] hover:bg-[#57577F]/12 hover:text-[#3f3f63] dark:text-white/85 dark:hover:bg-white/10 dark:hover:text-white"
                      }`}
                    >
                      <span className="block text-sm font-semibold tracking-[0.02em]">
                        {it.label}
                      </span>

                      {it.description && (
                        <span
                          className={`mt-0.5 block text-xs leading-snug ${
                            active
                              ? "text-[#fff8ec]/80 dark:text-[#CED7DF]/70"
                              : "text-[#4f473e] dark:text-white/45"
                          }`}
                        >
                          {it.description}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex items-center rounded-full border border-[#57577F]/20 bg-[#fff8ec]/75 px-1.5 py-1 shadow-[0_8px_22px_rgba(64,47,31,0.10)] dark:border-white/10 dark:bg-white/[0.04]">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}