import type { ReactNode } from "react";
import { Protected } from "../../lib/Protected";

export default function MixlistsLayout({ children }: { children: ReactNode }) {
  return <Protected>{children}</Protected>;
}
