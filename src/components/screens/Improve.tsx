"use client";

import type { Analysis, Choices } from "@/lib/types";
import BeforeAfterSlider from "../BeforeAfterSlider";
import { GlassButton, IconButton } from "../ui";

export default function Improve({
  image,
  analysis,
  choices,
  onBack,
  onDone,
}: {
  image: string;
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
    .filter((x): x is { issue: (typeof analysis.issues)[number]; sol: (typeof analysis.issues)[number]["solutions"][number] } => x !== null);

  // Compose the AI-enhanced preview from the chosen fixes.
  const afterFilter =
    applied.length > 0
      ? `saturate(1.04) ${applied.map((a) => a.sol.filter).filter(Boolean).join(" ")}`.trim()
      : undefined;

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
          Before <span className="text-[var(--ink-faint)]">·</span> After ✨
        </h2>
        <p className="mt-1.5 text-[14px] text-[var(--ink-soft)]">
          {applied.length > 0
            ? "Built from the fixes you picked — drag to compare."
            : "You discarded every fix, so this is all you. Drag to compare."}
        </p>
      </div>

      <div className="mx-auto mt-5 w-full max-w-[300px]">
        <BeforeAfterSlider before={image} afterFilter={afterFilter} />
      </div>

      <div className="glass mt-6 rounded-3xl p-5">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {applied.length > 0 ? "What I changed for you" : "What you kept"}
        </p>

        {applied.length > 0 ? (
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
                    For: {issue.title} — {sol.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            You kept your original look — sometimes the best edit is none. Trust
            those instincts. 💛
          </p>
        )}
      </div>

      <GlassButton className="mt-6 w-full" variant="cool" onClick={onDone}>
        Done — saved to history
      </GlassButton>
    </div>
  );
}
