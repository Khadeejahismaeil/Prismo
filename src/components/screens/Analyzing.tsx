"use client";

import { useEffect, useState } from "react";
import PrismoEating from "../PrismoEating";
import Prismo from "../Prismo";
import { GlassButton } from "../ui";
import { LOADING_MESSAGES } from "@/lib/mock";
import type { Source } from "@/lib/types";

export default function Analyzing({
  source,
  error,
  onRetry,
  onCancel,
}: {
  source: Source | null;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const [msg, setMsg] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setMsg((m) => (m + 1) % LOADING_MESSAGES.length),
      1200,
    );
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="screen-enter flex min-h-full flex-col items-center justify-center px-8 text-center">
        <div className="w-28 opacity-90">
          <Prismo className="h-auto w-full" />
        </div>
        <h2 className="mt-4 font-display text-[1.6rem] font-semibold text-[var(--ink)]">
          I couldn&apos;t review that
        </h2>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-[var(--ink-soft)]">
          {error}
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <GlassButton onClick={onRetry}>Try again</GlassButton>
          <button onClick={onCancel} className="press text-sm font-semibold text-[var(--ink-soft)]">
            Pick another screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-enter flex min-h-full flex-col items-center justify-center px-8 text-center">
      <div className="glass mb-8 w-28 overflow-hidden rounded-2xl p-1.5 opacity-90">
        {source?.kind === "raster" ? (
          <img src={source.payload} alt="" className="aspect-[9/16] w-full rounded-xl object-cover" />
        ) : source?.kind === "html" ? (
          <iframe title="" srcDoc={source.payload} sandbox="" className="pointer-events-none aspect-[9/16] w-full rounded-xl border-0 bg-white" />
        ) : (
          <div className="grid aspect-[9/16] w-full place-items-center rounded-xl bg-white text-3xl">🎨</div>
        )}
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

      <div className="mt-7 h-2 w-56 overflow-hidden rounded-full bg-white/50">
        <div
          className="bar-indeterminate h-full w-2/5 rounded-full"
          style={{ backgroundImage: "var(--grad-primary)" }}
        />
      </div>
    </div>
  );
}
