import type { Metadata } from "next";

export const SITE_URL = "https://www.kinfield.si";

/** The shared link preview, drawn by app/opengraph-image.tsx. */
const IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Kinfield: teach agents to trade" };

/**
 * A page's title, description, canonical address and link previews in one place, so
 * shares on X, Discord and search results describe that page rather than the homepage.
 */
export function pageMeta(path: string, title: string, description: string, opts: { index?: boolean } = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Kinfield", url: path, title, description, images: [IMAGE] },
    twitter: { card: "summary_large_image", site: "@kinfieldlabs", creator: "@kinfieldlabs", title, description, images: [IMAGE] },
    ...(opts.index === false && { robots: { index: false, follow: true } }),
  };
}
