import type { Metadata } from "next";
import "./access.css";

export const metadata: Metadata = {
  title: "Request Beta Access | Groovara",
  description:
    "Request access to the Groovara beta and help shape a more thoughtful way to share music.",
};

export default function AccessLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
