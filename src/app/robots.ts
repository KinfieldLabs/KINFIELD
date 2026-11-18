import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

/** Crawlers may read the site but not its API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
