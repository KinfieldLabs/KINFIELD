/** The docs, in reading order. Each page belongs to one group in the sidebar. */
export interface DocLink {
  slug: string;
  title: string;
  group: string;
  /** One line for the page's description and link previews. */
  summary: string;
}

export const GROUPS = ["Getting started", "The simulator", "Teaching your agent", "Verification", "Reference"] as const;

export const DOCS: DocLink[] = [
  { slug: "", title: "Introduction", group: "Getting started", summary: "What Kinfield is, how its pieces fit together, and what it is not." },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
