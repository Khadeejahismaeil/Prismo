"use client";

import { useCallback, useEffect, useState } from "react";
import type { Analysis, Choices, DesignType, Source } from "@/lib/types";
import { requestImprovement, type Fix } from "@/lib/analyzeClient";
import ScratchReveal from "../ScratchReveal";
import PrismoEating from "../PrismoEating";
import { GlassButton, IconButton } from "../ui";

export default function Improve({
  source,
  designType,
  analysis,
  choices,
  onBack,
  onDone,
  demoAfterHtml,
}: {
  source: Source;
  designType: DesignType;
  analysis: Analysis;
  choices: Choices;
  onBack: () => void;
  onDone: () => void;
  /** Demo mode: skip the API and reveal this preset redesign after a short beat. */
  demoAfterHtml?: string;
}) {
  const applied = analysis.issues
    .map((issue) => {
      const choice = choices[issue.id];
      if (!choice || choice === "discarded") return null;
      const sol = issue.solutions.find((s) => s.id === choice) ?? issue.solutions[0];
      return { issue, sol };
    })
    .filter(
      (x): x is { issue: (typeof analysis.issues)[number]; sol: (typeof analysis.issues)[number]["solutions"][number] } =>
        x !== null,
    );

  const hasFixes = applied.length > 0;
  const aspectRatio = analysis.viewport ? analysis.viewport.w / analysis.viewport.h : undefined;

  const [status, setStatus] = useState<"loading" | "ready" | "error">(hasFixes ? "loading" : "ready");
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  const generate = useCallback(async () => {
    if (!hasFixes) return;
    setStatus("loading");
    setError(null);
    if (demoAfterHtml) {
      await new Promise((r) => setTimeout(r, 1600));
      setHtml(demoAfterHtml);
      setStatus("ready");
      return;
    }
    const fixes: Fix[] = applied.map((a) => ({ title: a.issue.title, label: a.sol.label, detail: a.sol.detail }));
    try {
      const result = await requestImprovement(source, designType, fixes);
      setHtml(result);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
    // applied is derived from props; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, designType, hasFixes, demoAfterHtml]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <div className="screen-enter flex min-h-full flex-col px-5 pb-4 pt-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <IconButton label="Back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <p className="font-display text-lg font-semibold text-[var(--ink)]">Your glow-up ✨</p>
        <span className="w-10" />
      </div>

      <p className="mt-1 text-center text-[13px] text-[var(--ink-soft)]">
        {status === "loading"
          ? "Prismo is redrawing your screen…"
          : status === "error"
            ? "The redraw didn't land."
            : hasFixes
              ? "Swipe the dust away, or toggle Before / After."
              : "All you, no edits."}
      </p>

      {/* reveal renders at full width; the page scrolls a little if it's taller */}
      <div className="relative mt-3 flex-1">
        {status === "loading" && (
          <div className="grid min-h-[55vh] w-full place-items-center rounded-3xl border border-white/60 bg-white/60">
            <div className="flex flex-col items-center px-6 text-center">
              <div className="w-28" style={{ animation: "floaty 3s ease-in-out infinite" }}>
                <PrismoEating className="h-auto w-full" />
              </div>
              <p className="mt-3 text-[13px] font-medium text-[var(--ink-soft)]">Redrawing with your fixes…</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="grid min-h-[55vh] w-full place-items-center rounded-3xl border border-white/60 bg-white/60">
            <div className="flex flex-col items-center px-6 text-center">
              <p className="font-display text-lg font-semibold text-[var(--ink)]">Couldn&apos;t redraw it</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{error}</p>
              <GlassButton className="mt-4" onClick={generate}>Try again</GlassButton>
            </div>
          </div>
        )}

        {status === "ready" && (
          <ScratchReveal
            before={source.kind === "raster" ? source.payload : undefined}
            beforeHtml={source.kind === "html" ? source.payload : undefined}
            afterHtml={hasFixes && html ? html : undefined}
            aspectRatio={aspectRatio}
          />
        )}

        {/* collapsible "What I changed" sheet */}
        {showChanges && (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto rounded-3xl glass-strong p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink)]">
                {hasFixes ? "What I changed for you" : "What you kept"}
              </p>
              <button onClick={() => setShowChanges(false)} aria-label="Close" className="press text-[var(--ink-faint)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {hasFixes ? (
              <ul className="flex flex-col gap-3">
                {applied.map(({ issue, sol }) => (
                  <li key={issue.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white" style={{ backgroundImage: "var(--grad-primary)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13.5px] font-semibold text-[var(--ink)]">{sol.label}</span>
                      <span className="block text-[12.5px] leading-snug text-[var(--ink-soft)]">For: {issue.title}, {sol.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                You kept your original look, sometimes the best edit is none. 💛
              </p>
            )}
          </div>
        )}
      </div>

      {/* bottom bar */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setShowChanges((v) => !v)}
          className="press glass shrink-0 rounded-2xl px-3.5 py-3 text-[13px] font-semibold text-[var(--ink)]"
        >
          ✨ What changed{hasFixes ? ` (${applied.length})` : ""}
        </button>
        <GlassButton className="flex-1" variant="cool" onClick={onDone}>
          Done
        </GlassButton>
      </div>
    </div>
  );
}
