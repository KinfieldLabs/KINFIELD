import type { MetadataRoute } from "next";
import { DOCS, docHref } from "@/components/docs/nav";
import { SITE_URL } from "@/lib/meta";

/**
 * The public pages worth indexing. Coming soon pages stay out until they open, and the
 * agent page is personal to whoever is signed in.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ["/", 1],
    ["/simulate", 0.9],
    ["/privacy", 0.3],
    ["/terms", 0.3],
    ...DOCS.map((d): [string, number] => [docHref(d.slug), d.slug ? 0.6 : 0.7]),
  ];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly", priority }));
}
