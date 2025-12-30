import type { ReactNode } from "react";
import { Protected } from "../../lib/Protected";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Protected>{children}</Protected>;
}
