import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

const csp = `
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'self';
  form-action 'self';
  img-src 'self' data: blob:
    https://i.ytimg.com
    https://i.scdn.co
    https://is1-ssl.mzstatic.com;
  media-src 'self' blob: https://open.spotify.com https://embed.music.apple.com;
  font-src 'self' data:;
  style-src 'self' 'unsafe-inline' https:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
  connect-src 'self' ${supabaseOrigin} https://api.spotify.com wss:;
  frame-src 'self'
    https://open.spotify.com
    https://www.youtube.com
    https://youtube.com
    https://www.youtube-nocookie.com
    https://music.apple.com
    https://embed.music.apple.com;
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
    async rewrites() {
    return [
      {
        source: "/gv-collect/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/gv-collect/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/gv-collect/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;


export default nextConfig;