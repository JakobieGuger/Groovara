"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function PostHogPageView() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("$pageview", {
      pathname,
      current_url: window.location.href,
    });
  }, [pathname]);

  return null;
}