"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

export function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!hasSession) {
        router.replace("/login");
        return;
      }

      if (isMounted) setReady(true);
    };

    check();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Keep it simple: render nothing until we know.
  if (!ready) return null;

  return <>{children}</>;
}
