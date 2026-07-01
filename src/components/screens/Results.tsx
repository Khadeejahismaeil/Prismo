"use client";

import { useRef, useState } from "react";
import type { Analysis, Choices, Severity } from "@/lib/types";
import Prismo from "../Prismo";
import { GlassButton, IconButton, ScoreRing } from "../ui";

const sev: Record<Severity, { ring: string; chip: string; label: string }> = {
  high: { ring: "#f3728a", chip: "bg-[#fde2e7] text-[#c43a55]", label: "High impact" },
  medium: { ring: "#f4a93a", chip: "bg-[#fdeecf] text-[#a8761a]", label: "Medium" },
  low: { ring: "#54c3e3", chip: "bg-[#d6f1f9] text-[#1f7d97]", label: "Polish" },
};

function HeaderBar({ onNew, onHistory }: { onNew: () => void; onHistory: () => void }) {
  return (
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
  );
}

function Strengths({ items }: { items: string[] }) {
  return (
    <div className="glass mt-4 rounded-3xl p-5">
      <p className="text-sm font-semibold text-[var(--ink)]">What&apos;s working ✨</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((s) => (
          <li key={s} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ink-soft)]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white" style={{ backgroundImage: "var(--grad-cool)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Results({
  image,
  analysis,
  choices,
  onChoose,
  onImprove,
  onNew,
  onDone,
  onHistory,
}: {
  image: string;
  analysis: Analysis;
  choices: Choices;
  onChoose: (issueId: string, value: string) => void;
  onImprove: () => void;
  onNew: () => void;
  onDone: () => void;
  onHistory: () => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const focusIssue = (i: number) => {
    setActive(i);
    cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const kept = analysis.issues.filter((i) => choices[i.id] !== "discarded").length;

  /* ---------- clean design: nothing to fix ---------- */
  if (analysis.issues.length === 0) {
    return (
      <div className="screen-enter flex min-h-full flex-col px-5 pb-8 pt-3">
        <HeaderBar onNew={onNew} onHistory={onHistory} />
        <div className="glass-strong mt-3 flex flex-col items-center rounded-[2rem] px-6 py-7 text-center">
          <ScoreRing score={analysis.score} />
          <h2 className="mt-4 font-display text-[1.8rem] font-semibold text-[var(--ink)]">
            {analysis.headline}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            {analysis.summary}
          </p>
        </div>

        <div className="mt-5 flex flex-col items-center text-center">
          <div className="w-28" style={{ animation: "floaty 4s ease-in-out infinite" }}>
            <Prismo className="h-auto w-full" />
          </div>
          <p className="mt-2 text-[15px] font-medium text-[var(--ink)]">
            No fixes needed, I&apos;d ship this. 🎉
          </p>
        </div>

        <Strengths items={analysis.strengths} />

        <GlassButton className="mt-6 w-full" variant="cool" onClick={onDone}>
          Save to history
        </GlassButton>
        <button onClick={onNew} className="press mx-auto mt-3 text-sm font-semibold text-[var(--ink-soft)]">
          Review another screen
        </button>
      </div>
    );
  }

  /* ---------- design with fixes ---------- */
  return (
    <div className="screen-enter flex min-h-full flex-col px-5 pb-8 pt-3">
      <HeaderBar onNew={onNew} onHistory={onHistory} />

      <div className="glass-strong mt-3 flex flex-col items-center rounded-[2rem] px-6 py-7 text-center">
        <ScoreRing score={analysis.score} />
        <h2 className="mt-4 font-display text-[1.7rem] font-semibold text-[var(--ink)]">
          {analysis.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          {analysis.summary}
        </p>
        {analysis.purpose && (
          <p className="mt-3 rounded-2xl bg-white/55 px-3 py-2 text-[12.5px] leading-snug text-[var(--ink)]">
            <span className="font-semibold">Prismo sees</span> {analysis.purpose}
          </p>
        )}
      </div>

      <Strengths items={analysis.strengths} />

      {/* annotated screenshot */}
      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
          What to look at
        </p>
        <div className="glass relative overflow-hidden rounded-3xl p-1.5">
          <div className="relative overflow-hidden rounded-[1.35rem]">
            <img src={image} alt="Your design with annotations" className="block w-full" />
            {analysis.issues.map((issue, i) => {
              const discarded = choices[issue.id] === "discarded";
              return (
                <button
                  key={issue.id}
                  onClick={() => focusIssue(i)}
                  aria-label={`Issue ${i + 1}: ${issue.title}`}
                  className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-bold text-white"
                  style={{
                    left: `${issue.x}%`,
                    top: `${issue.y}%`,
                    background: sev[issue.severity].ring,
                    border: "2.5px solid rgba(255,255,255,0.95)",
                    boxShadow: `0 6px 16px -4px ${sev[issue.severity].ring}`,
                    opacity: discarded ? 0.35 : 1,
                    transform: `translate(-50%,-50%) scale(${active === i ? 1.2 : 1})`,
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* issue cards with solution chooser */}
      <div className="mt-5 flex flex-col gap-3">
        {analysis.issues.map((issue, i) => {
          const choice = choices[issue.id];
          const discarded = choice === "discarded";
          return (
            <div
              key={issue.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="glass rounded-3xl p-4 transition-all"
              style={
                active === i && !discarded
                  ? { boxShadow: `0 0 0 2px ${sev[issue.severity].ring}, var(--glass-shadow)` }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ background: sev[issue.severity].ring, opacity: discarded ? 0.4 : 1 }}
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-semibold ${discarded ? "text-[var(--ink-faint)] line-through" : "text-[var(--ink)]"}`}>
                      {issue.title}
                    </h3>
                    <span className="flex shrink-0 items-center gap-1">
                      {issue.measured && (
                        <span className="rounded-full bg-[#dff3e6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1f8a4c]">
                          ✓ Measured
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sev[issue.severity].chip}`}>
                        {sev[issue.severity].label}
                      </span>
                    </span>
                  </div>

                  {discarded ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-white/45 px-3 py-2.5">
                      <span className="text-[13px] font-medium text-[var(--ink-soft)]">
                        Keeping your original here 👍
                      </span>
                      <button
                        onClick={() => onChoose(issue.id, issue.solutions[0].id)}
                        className="press text-[13px] font-bold text-[var(--ink)]"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                        {issue.explanation}
                      </p>
                      {issue.why && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                          <span className="font-semibold text-[var(--ink)]">Why it matters:</span>{" "}
                          {issue.why}
                        </p>
                      )}
                      {issue.metric && (
                        <p className="mt-2 inline-block rounded-lg bg-[var(--ink)]/5 px-2 py-1 font-mono text-[11px] font-medium text-[var(--ink)]">
                          {issue.metric}
                        </p>
                      )}
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                        Choose a fix
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {issue.solutions.map((s) => {
                          const selected = choice === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => onChoose(issue.id, s.id)}
                              className="press flex items-start gap-2.5 rounded-2xl p-2.5 text-left transition-all"
                              style={
                                selected
                                  ? { background: "rgba(255,255,255,0.9)", boxShadow: `inset 0 0 0 1.5px ${sev[issue.severity].ring}` }
                                  : { background: "rgba(255,255,255,0.45)" }
                              }
                            >
                              <span
                                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2"
                                style={{ borderColor: selected ? sev[issue.severity].ring : "rgba(54,32,44,0.2)", background: selected ? sev[issue.severity].ring : "transparent" }}
                              >
                                {selected && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              <span className="flex-1">
                                <span className="block text-[13.5px] font-semibold text-[var(--ink)]">{s.label}</span>
                                <span className="block text-[12px] leading-snug text-[var(--ink-soft)]">{s.detail}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => onChoose(issue.id, "discarded")}
                        className="press mt-2 text-[12.5px] font-semibold text-[var(--ink-faint)]"
                      >
                        ✕ Discard this fix
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <GlassButton className="mt-6 w-full" variant="primary" onClick={onImprove}>
        ✨ See my glow-up{kept > 0 ? ` (${kept})` : ""}
      </GlassButton>
      <button onClick={onNew} className="press mx-auto mt-3 text-sm font-semibold text-[var(--ink-soft)]">
        Review another screen
      </button>
    </div>
  );
}
