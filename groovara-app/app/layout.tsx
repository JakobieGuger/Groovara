import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppNav from "@/lib/AppNav";
import ThemeProvider from "@/lib/theme-provider";
import { PostHogProvider } from "@/lib/PostHogProvider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PostHogPageView from "@/lib/PostHogPageView";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
    default: "Groovara",
    template: "%s | Groovara",
  },
  description: "Heart of a mixtape. Power of a playlist.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
return (
  <html lang="en" suppressHydrationWarning>
    <body
      className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
    >
      <PostHogProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AppNav />
          <div className="pt-14 min-h-screen">
            {children}
            <Analytics />
            <SpeedInsights />
            <PostHogPageView />
          </div>
        </ThemeProvider>
      </PostHogProvider>
    </body>
  </html>
);
}
