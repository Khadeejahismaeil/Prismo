"use client";

import type { HistoryEntry } from "@/lib/types";
import Prismo from "../Prismo";
import { GlassButton, IconButton } from "../ui";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function History({
  entries,
  onOpen,
  onNew,
  onClear,
}: {
  entries: HistoryEntry[];
  onOpen: (e: HistoryEntry) => void;
  onNew: () => void;
  onClear: () => void;
}) {
  return (
    <div className="screen-enter flex min-h-full flex-col px-5 pb-8 pt-3">
      <div className="flex items-center justify-between">
        <IconButton label="Back" onClick={onNew}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <p className="text-sm font-semibold text-[var(--ink-soft)]">History</p>
        {entries.length > 0 ? (
          <button onClick={onClear} className="press text-xs font-semibold text-[var(--ink-faint)]">
            Clear
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <h2 className="mt-2 font-display text-[1.9rem] font-semibold text-[var(--ink)]">
        Your reviews
      </h2>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="w-36 opacity-90" style={{ animation: "floaty 5s ease-in-out infinite" }}>
            <Prismo className="h-auto w-full" />
          </div>
          <p className="mt-4 font-display text-xl font-semibold text-[var(--ink)]">
            No reviews yet
          </p>
          <p className="mt-1.5 max-w-[15rem] text-sm text-[var(--ink-soft)]">
            Every screen you analyze shows up here so you can track your glow-ups.
          </p>
          <GlassButton className="mt-6" onClick={onNew}>
            Review your first screen
          </GlassButton>
        </div>
      ) : (
        <div className="stagger mt-4 flex flex-col gap-3">
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => onOpen(e)}
              className="press glass flex items-center gap-3.5 rounded-3xl p-3 text-left"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white">
                <img src={e.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--ink)]">{e.designType}</p>
                <p className="text-xs text-[var(--ink-soft)]">
                  {fmt(e.date)} · {e.analysis.issues.length} fixes
                </p>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-2xl font-semibold leading-none text-[var(--ink)]">
                  {e.score}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  score
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
