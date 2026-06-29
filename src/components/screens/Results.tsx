"use client";

import { useRef, useState } from "react";
import type { Analysis, Severity } from "@/lib/types";
import { GlassButton, IconButton, ScoreRing } from "../ui";

const sev: Record<Severity, { ring: string; chip: string; label: string }> = {
  high: { ring: "#f3728a", chip: "bg-[#fde2e7] text-[#c43a55]", label: "High impact" },
  medium: { ring: "#f4a93a", chip: "bg-[#fdeecf] text-[#a8761a]", label: "Medium" },
  low: { ring: "#54c3e3", chip: "bg-[#d6f1f9] text-[#1f7d97]", label: "Polish" },
};

export default function Results({
  name,
  image,
  analysis,
  onImprove,
  onNew,
  onHistory,
}: {
  name: string;
  image: string;
  analysis: Analysis;
  onImprove: () => void;
  onNew: () => void;
  onHistory: () => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const focusIssue = (i: number) => {
    setActive(i);
    cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="screen-enter flex min-h-full flex-col px-5 pb-8 pt-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <IconButton label="New review" onClick={onNew}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <p className="text-sm font-semibold text-[var(--ink-soft)]">Your review</p>
        <IconButton label="History" onClick={onHistory}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.5 9a9 9 0 1 1-.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M3 5v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      </div>

      {/* score hero */}
      <div className="glass-strong mt-3 flex flex-col items-center rounded-[2rem] px-6 py-7 text-center">
        <ScoreRing score={analysis.score} />
        <h2 className="mt-4 font-display text-[1.7rem] font-semibold text-[var(--ink)]">
          {analysis.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          {analysis.summary}
        </p>
      </div>

      {/* annotated screenshot */}
      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
          I circled the 4 things to fix first
        </p>
        <div className="glass relative overflow-hidden rounded-3xl p-1.5">
          <div className="relative overflow-hidden rounded-[1.35rem]">
            <img src={image} alt="Your design with annotations" className="block w-full" />
            {analysis.issues.map((issue, i) => (
              <button
                key={issue.id}
                onClick={() => focusIssue(i)}
                aria-label={`Issue ${i + 1}: ${issue.title}`}
                className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-bold text-white transition-transform"
                style={{
                  left: `${issue.x}%`,
                  top: `${issue.y}%`,
                  background: sev[issue.severity].ring,
                  border: "2.5px solid rgba(255,255,255,0.95)",
                  boxShadow: `0 6px 16px -4px ${sev[issue.severity].ring}`,
                  transform: `translate(-50%,-50%) scale(${active === i ? 1.2 : 1})`,
                  animation: "ringBreathe 2.4s ease-in-out infinite",
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* issue cards */}
      <div className="mt-5 flex flex-col gap-3">
        {analysis.issues.map((issue, i) => (
          <div
            key={issue.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            onClick={() => setActive(i)}
            className="glass rounded-3xl p-4 transition-all"
            style={
              active === i
                ? { boxShadow: `0 0 0 2px ${sev[issue.severity].ring}, var(--glass-shadow)` }
                : undefined
            }
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: sev[issue.severity].ring }}
              >
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-[var(--ink)]">{issue.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sev[issue.severity].chip}`}>
                    {sev[issue.severity].label}
                  </span>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                  {issue.explanation}
                </p>
                <div className="mt-2.5 flex items-start gap-2 rounded-2xl bg-white/55 p-2.5">
                  <span className="text-base leading-none">💡</span>
                  <p className="text-[13px] font-medium leading-relaxed text-[var(--ink)]">
                    {issue.suggestion}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <GlassButton className="mt-6 w-full" variant="primary" onClick={onImprove}>
        ✨ See Prismo&apos;s glow-up
      </GlassButton>
      <button
        onClick={onNew}
        className="press mx-auto mt-3 text-sm font-semibold text-[var(--ink-soft)]"
      >
        Review another screen
      </button>
    </div>
  );
}
