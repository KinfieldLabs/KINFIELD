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
  { slug: "chart", title: "Chart tools", group: "The simulator", summary: "Indicators, drawing tools and keyboard shortcuts on the price chart." },
  { slug: "strategies", title: "Strategies and reasons", group: "Teaching your agent", summary: "Tagging each trade with a strategy and a written reason, and how reasons stay private." },
  { slug: "market-context", title: "Market context", group: "Teaching your agent", summary: "The six market features recorded at the moment of every decision." },
  { slug: "agent", title: "Your agent", group: "Teaching your agent", summary: "How your agent learns from your closed trades, and how to read what it has learned." },
  { slug: "autonomous", title: "The agent trading on its own", group: "Teaching your agent", summary: "When and how your agent trades its own simulated account." },
  { slug: "readiness", title: "Readiness checks", group: "Teaching your agent", summary: "The seven checks a track record is judged on, and how each is computed." },
  { slug: "ledger", title: "The verified ledger", group: "Verification", summary: "How fills are priced, how triggers are replayed, and the hash chain behind every account." },
  { slug: "dataset", title: "The open dataset", group: "Verification", summary: "What is published, when, in which files and under which licence." },
  { slug: "verify", title: "Verifying the data", group: "Verification", summary: "Rechecking every published trade with verify.mjs, or by hand." },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
