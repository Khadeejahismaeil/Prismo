"use client";

import { useCallback, useEffect, useState } from "react";
import type { Analysis, Choices, DesignType } from "@/lib/types";
import { requestImprovement, type Fix } from "@/lib/analyzeClient";
import ScratchReveal from "../ScratchReveal";
import PrismoEating from "../PrismoEating";
import { GlassButton, IconButton } from "../ui";

export default function Improve({
  image,
  designType,
  analysis,
  choices,
  onBack,
  onDone,
}: {
  image: string;
  designType: DesignType;
  analysis: Analysis;
  choices: Choices;
  onBack: () => void;
  onDone: () => void;
}) {
  // Resolve the user's picks into the applied solutions.
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

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    hasFixes ? "loading" : "ready",
  );
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!hasFixes) return;
    setStatus("loading");
    setError(null);
    const fixes: Fix[] = applied.map((a) => ({
      title: a.issue.title,
      label: a.sol.label,
      detail: a.sol.detail,
    }));
    try {
      const result = await requestImprovement(image, designType, fixes);
      setHtml(result);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
    // applied is derived from props; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, designType, hasFixes]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <div className="screen-enter flex min-h-full flex-col px-5 pb-8 pt-3">
      <div className="flex items-center justify-between">
        <IconButton label="Back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <p className="text-sm font-semibold text-[var(--ink-soft)]">The glow-up</p>
        <span className="w-10" />
      </div>

      <div className="mt-2 text-center">
        <h2 className="font-display text-[1.9rem] font-semibold text-[var(--ink)]">
          Your glow-up ✨
        </h2>
        <p className="mt-1.5 text-[14px] text-[var(--ink-soft)]">
          {status === "loading"
            ? "Prismo is redrawing your screen…"
            : status === "error"
              ? "The redraw didn't land."
              : hasFixes
                ? "Swipe the dust away to reveal it."
                : "All you, no edits. Swipe to see."}
        </p>
      </div>

      <div className="mx-auto mt-5 w-full max-w-[300px]">
        {status === "loading" && (
          <div className="grid aspect-[9/16] w-full place-items-center rounded-3xl border border-white/60 bg-white/60">
            <div className="flex flex-col items-center px-6 text-center">
              <div className="w-32" style={{ animation: "floaty 3s ease-in-out infinite" }}>
                <PrismoEating className="h-auto w-full" />
              </div>
              <p className="mt-3 text-[13px] font-medium text-[var(--ink-soft)]">
                Redrawing with your fixes…
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="grid aspect-[9/16] w-full place-items-center rounded-3xl border border-white/60 bg-white/60">
            <div className="flex flex-col items-center px-6 text-center">
              <p className="font-display text-lg font-semibold text-[var(--ink)]">
                Couldn&apos;t redraw it
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                {error}
              </p>
              <GlassButton className="mt-4" onClick={generate}>
                Try again
              </GlassButton>
            </div>
          </div>
        )}

        {status === "ready" && (
          <ScratchReveal before={image} afterHtml={hasFixes && html ? html : undefined} />
        )}
      </div>

      <div className="glass mt-6 rounded-3xl p-5">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {hasFixes ? "What I changed for you" : "What you kept"}
        </p>

        {hasFixes ? (
          <ul className="mt-3 flex flex-col gap-3">
            {applied.map(({ issue, sol }) => (
              <li key={issue.id} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundImage: "var(--grad-primary)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="block text-[13.5px] font-semibold text-[var(--ink)]">
                    {sol.label}
                  </span>
                  <span className="block text-[12.5px] leading-snug text-[var(--ink-soft)]">
                    For: {issue.title}, {sol.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            You kept your original look, sometimes the best edit is none. Trust
            those instincts. 💛
          </p>
        )}
      </div>

      <GlassButton className="mt-6 w-full" variant="cool" onClick={onDone}>
        Done, saved to history
      </GlassButton>
    </div>
  );
}
