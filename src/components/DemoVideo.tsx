"use client";

import { useEffect, useRef } from "react";

/**
 * The simulator walkthrough, looping with no sound and no controls. A click, or Enter or
 * Space when focused, pauses it and plays it again. It starts paused for people who ask
 * for less motion.
 */
export function DemoVideo({ mp4, webm, poster, className = "" }: { mp4: string; webm?: string; poster?: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.current?.pause();
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <video
      ref={video}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      aria-label="Video: placing and closing a trade in the Kinfield simulator, then the agent page. Click to pause or play."
      className={`block w-full cursor-pointer rounded-2xl border border-line bg-navy-950 shadow-2xl shadow-black/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan ${className}`}
    >
      {webm && <source src={webm} type="video/webm" />}
      <source src={mp4} type="video/mp4" />
    </video>
  );
}
