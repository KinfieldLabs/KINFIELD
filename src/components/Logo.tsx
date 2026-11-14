import Link from "next/link";

/** The Kinfield four-blade mark, traced from the brand artwork. */
export function Mark({ className = "h-7 w-7", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="384 374 1160 1160" className={className} fill={color} aria-hidden>
      <path d="M958 418 L958 890 Q958 925 930 916 L782 828 Z" />
      <path d="M998 698 L1075 810 L1530 968 L1022 980 Q998 980 998 955 Z" />
      <path d="M398 958 L905 932 Q933 932 933 960 L933 1217 L857 1107 Z" />
      <path d="M966 985 L1142 1087 L966 1490 Z" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 text-cream">
      <Mark className="h-8 w-8" />
      <span className="text-[15px] font-semibold tracking-[0.42em]">KINFIELD</span>
    </Link>
  );
}
