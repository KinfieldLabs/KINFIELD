import type { NextConfig } from "next";

/** Sent with every response: no framing by other sites, no MIME sniffing, and no browser features the site doesn't use. */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The dataset publisher ships verify.mjs into the dataset repository
  outputFileTracingIncludes: {
    "/api/cron/publish": ["./dataset/**"],
  },
};

export default nextConfig;
