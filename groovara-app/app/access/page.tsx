import Script from "next/script";
import "./access-request-v2.css";
import { BetaRequestForm } from "./beta-request-form";

export default function AccessPage() {
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <>
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
        />
      ) : null}

      <BetaRequestForm turnstileSiteKey={turnstileSiteKey} />
    </>
  );
}
