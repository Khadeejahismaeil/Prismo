"use client";

import { useState } from "react";
import Prismo from "../Prismo";
import { GlassButton } from "../ui";

export default function Welcome({
  initialName,
  onContinue,
  onDemo,
}: {
  initialName: string;
  onContinue: (name: string) => void;
  onDemo: () => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <div className="screen-enter flex min-h-full flex-col px-6 pb-10 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="w-44" style={{ animation: "floaty 5s ease-in-out infinite" }}>
          <Prismo className="h-auto w-full" />
        </div>

        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-faint)]">
          Hi there 👋
        </p>
        <h1 className="mt-2 font-display text-[2.6rem] font-semibold leading-[1.05] text-[var(--ink)]">
          I&apos;m <span className="text-gradient">Prismo</span>,
          <br /> your design buddy.
        </h1>
        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-[var(--ink-soft)]">
          Show me any screen and I&apos;ll give you warm, useful feedback, and
          even a glow-up. First, what should I call you?
        </p>

        <div className="glass mt-7 w-full max-w-xs rounded-2xl p-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onContinue(name.trim())}
            placeholder="Your name"
            className="w-full rounded-xl bg-transparent px-4 py-3 text-center text-[17px] font-medium text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none"
          />
        </div>
      </div>

      <GlassButton
        className="w-full max-w-xs self-center"
        disabled={!name.trim()}
        onClick={() => onContinue(name.trim())}
      >
        Nice to meet you →
      </GlassButton>
      <button
        onClick={onDemo}
        className="press mx-auto mt-3 text-sm font-semibold text-[var(--ink-soft)]"
      >
        ▶︎ Watch a quick demo
      </button>
    </div>
  );
}
