"use client";

import { useEffect, useState } from "react";
import PrismoEating from "../PrismoEating";
import { LOADING_MESSAGES } from "@/lib/mock";

export default function Analyzing({
  image,
  onComplete,
}: {
  image: string;
  onComplete: () => void;
}) {
  const [msg, setMsg] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const total = 5200;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / total);
      setProgress(p);
      setMsg(Math.min(LOADING_MESSAGES.length - 1, Math.floor(p * LOADING_MESSAGES.length)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else onComplete();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <div className="screen-enter flex min-h-full flex-col items-center justify-center px-8 text-center">
      {/* faint preview of what's being reviewed */}
      <div className="glass mb-8 w-28 overflow-hidden rounded-2xl p-1.5 opacity-90">
        <img src={image} alt="" className="aspect-[9/16] w-full rounded-xl object-cover" />
      </div>

      <div className="w-52" style={{ animation: "floaty 3s ease-in-out infinite" }}>
        <PrismoEating className="h-auto w-full" />
      </div>

      <h2 className="mt-6 font-display text-[1.7rem] font-semibold text-[var(--ink)]">
        Prismo is reviewing…
      </h2>
      <p
        key={msg}
        className="mt-2 h-6 text-[15px] font-medium text-[var(--ink-soft)]"
        style={{ animation: "fadeUp 0.4s ease both" }}
      >
        {LOADING_MESSAGES[msg]}
      </p>

      {/* progress */}
      <div className="mt-7 h-2 w-56 overflow-hidden rounded-full bg-white/50">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${progress * 100}%`, backgroundImage: "var(--grad-primary)" }}
        />
      </div>
    </div>
  );
}
