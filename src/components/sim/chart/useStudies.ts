"use client";

import { useEffect, useState } from "react";
import { STUDIES, type Study, type StudyKind } from "./studies";

const KEY = "kinfield.indicators";
const MAX = 10;

/** Accepts a saved indicator only if it still fits its definition. */
function valid(x: unknown): x is Study {
  const s = x as Study;
  const def = s && STUDIES[s.kind];
  return (
    !!def &&
    typeof s.id === "string" &&
    Number.isInteger(s.slot) &&
    s.slot >= 0 &&
    Array.isArray(s.params) &&
    s.params.length === def.params.length &&
    s.params.every((v, i) => Number.isFinite(v) && v >= def.params[i].min && v <= def.params[i].max)
  );
}

/** The indicators on the chart, remembered in this browser across markets and visits. */
export function useStudies() {
  const [studies, setStudies] = useState<Study[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(saved)) setStudies(saved.filter(valid).slice(0, MAX));
    } catch {}
  }, []);

  const save = (next: Study[]) => {
    setStudies(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  return {
    studies,
    full: studies.length >= MAX,
    add(kind: StudyKind) {
      if (studies.length >= MAX) return;
      const used = new Set(studies.map((s) => s.slot));
      let slot = 0;
      while (used.has(slot)) slot++;
      const id = Math.random().toString(36).slice(2, 10);
      save([...studies, { id, kind, params: STUDIES[kind].params.map((p) => p.value), slot }]);
    },
    remove(id: string) {
      save(studies.filter((s) => s.id !== id));
    },
    toggle(id: string) {
      save(studies.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s)));
    },
  };
}
