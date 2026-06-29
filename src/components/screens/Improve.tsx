"use client";

import BeforeAfterSlider from "../BeforeAfterSlider";
import { GlassButton, IconButton } from "../ui";

const CHANGES = [
  "Boosted the heading so hierarchy reads instantly",
  "Gave the primary button a confident brand fill",
  "Darkened body text to clear AA contrast",
  "Evened out spacing on an 8-pt rhythm",
];

export default function Improve({
  image,
  onBack,
  onDone,
}: {
  image: string;
  onBack: () => void;
  onDone: () => void;
}) {
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
          Drag the handle to see Prismo&apos;s enhanced version.
        </p>
      </div>

      <div className="mx-auto mt-5 w-full max-w-[300px]">
        <BeforeAfterSlider
          before={image}
          afterFilter="saturate(1.18) contrast(1.08) brightness(1.03)"
        />
      </div>

      <div className="glass mt-6 rounded-3xl p-5">
        <p className="text-sm font-semibold text-[var(--ink)]">What I changed</p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {CHANGES.map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ink-soft)]">
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                style={{ backgroundImage: "var(--grad-primary)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>

      <GlassButton className="mt-6 w-full" variant="cool" onClick={onDone}>
        Done — saved to history
      </GlassButton>
    </div>
  );
}
