export function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 4 : 5;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtUsd(n: number, signed = false): string {
  if (!Number.isFinite(n)) return "N/A";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  return `${sign}$${s}`;
}

export function fmtPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "N/A";
  return `${n > 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
}

export function fmtCompact(n: number): string {
  return "$" + Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export const tone = (n: number) => (n > 0 ? "text-long" : n < 0 ? "text-short" : "text-muted");

/** Decimals that suit a price's magnitude (5 significant figures, like Hyperliquid). */
export function pxDecimals(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 2;
  return Math.max(0, Math.min(6, 4 - Math.floor(Math.log10(px))));
}

export function fmtNum(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return "N/A";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Price with decimals chosen from a reference price, so a column lines up. */
export const fmtPxAt = (n: number, ref: number) => fmtNum(n, pxDecimals(ref));

export function fmtTime(ms: number, seconds = false): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
  });
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  // Some locales write "Sept"; keep three-letter months everywhere, like the chart
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).replace("Sept", "Sep")} ${fmtTime(ms)}`;
}

export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(m, 0)}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
