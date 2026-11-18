import type { KeyboardEvent } from "react";

/**
 * Accessible tab props for a row of tabs: each tab names its panel, only the selected
 * tab is in the Tab order, and arrow keys, Home and End move between tabs.
 */
export function tabProps<T extends string>(id: string, keys: readonly T[], current: T, select: (k: T) => void) {
  const tabId = (k: T) => `${id}-tab-${k}`;
  const panelId = `${id}-panel`;
  const onKeyDown = (e: KeyboardEvent) => {
    const at = keys.indexOf(current);
    const next =
      e.key === "ArrowRight" ? keys[(at + 1) % keys.length]
      : e.key === "ArrowLeft" ? keys[(at - 1 + keys.length) % keys.length]
      : e.key === "Home" ? keys[0]
      : e.key === "End" ? keys[keys.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    select(next);
    document.getElementById(tabId(next))?.focus();
  };
  return {
    list: { role: "tablist" as const, onKeyDown },
    tab: (k: T) => ({
      id: tabId(k),
      role: "tab" as const,
      "aria-selected": current === k,
      "aria-controls": panelId,
      tabIndex: current === k ? 0 : -1,
    }),
    panel: { id: panelId, role: "tabpanel" as const, "aria-labelledby": tabId(current) },
  };
}
