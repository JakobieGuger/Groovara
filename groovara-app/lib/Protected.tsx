"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export function Protected({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setReady(!!data.session);
      }
    };

    check();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}