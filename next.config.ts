import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dataset publisher ships verify.mjs into the dataset repository
  outputFileTracingIncludes: {
    "/api/cron/publish": ["./dataset/**"],
  },
};

export default nextConfig;
