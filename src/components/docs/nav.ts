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
  { slug: "quickstart", title: "Quickstart", group: "Getting started", summary: "Place your first simulated trade and see what it teaches your agent." },
  { slug: "accounts", title: "Guest mode and accounts", group: "Getting started", summary: "What works as a guest, what signing in with GitHub adds, and how to reset or delete an account." },
  { slug: "simulator", title: "The trading terminal", group: "The simulator", summary: "Markets, live data and every panel of the simulator." },
  { slug: "orders", title: "Orders and positions", group: "The simulator", summary: "Market and limit orders, leverage, margin, fees, take profit, stop loss and liquidation." },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
