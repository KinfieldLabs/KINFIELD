/** Decorative flowing signal lines, echoing the banner artwork. */
export function Waves({ className = "" }: { className?: string }) {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg viewBox="0 0 600 500" className={className} fill="none" aria-hidden>
      {lines.map((i) => {
        const o = i * 9;
        return (
          <path
            key={i}
            d={`M0 ${330 + o * 0.4} C 180 ${330 + o * 0.5}, 260 ${300 - o}, 380 ${200 - o * 0.6} S 560 ${40 + o}, 600 ${20 + o * 1.2}`}
            stroke="var(--cyan)"
            strokeOpacity={i === 4 ? 0.9 : 0.12 + (i % 4) * 0.05}
            strokeWidth={i === 4 ? 1.6 : 0.8}
          />
        );
      })}
      {[
        [430, 150],
        [500, 110],
        [520, 230],
        [560, 70],
        [470, 290],
        [380, 260],
      ].map(([x, y], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x} y2={y + 70} stroke="var(--cyan)" strokeOpacity="0.25" />
          <circle cx={x} cy={y} r={i % 2 ? 2.5 : 4} fill="var(--cyan)" />
        </g>
      ))}
      <rect x="540" y="320" width="10" height="10" stroke="var(--cyan)" strokeOpacity="0.7" />
      <circle cx="490" cy="40" r="5" stroke="var(--cyan)" strokeOpacity="0.7" />
    </svg>
  );
}
