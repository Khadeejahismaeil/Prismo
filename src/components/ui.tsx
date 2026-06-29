"use client";

import { useEffect, useRef, useState } from "react";

/* ---------------- Glass button ---------------- */
export function GlassButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "cool";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "press inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold tracking-tight disabled:opacity-40 disabled:pointer-events-none select-none";
  const styles =
    variant === "primary"
      ? "text-white shadow-[0_12px_30px_-10px_rgba(231,146,156,0.9)]"
      : variant === "cool"
        ? "text-white shadow-[0_12px_30px_-10px_rgba(115,222,244,0.9)]"
        : "glass text-[var(--ink)]";
  const inline =
    variant === "primary"
      ? { backgroundImage: "var(--grad-primary)" }
      : variant === "cool"
        ? { backgroundImage: "var(--grad-cool)" }
        : undefined;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
      style={inline}
    >
      {children}
    </button>
  );
}

/* ---------------- Selectable chip ---------------- */
export function Chip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`press flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
        selected
          ? "text-[var(--ink)] shadow-[0_8px_22px_-12px_rgba(54,32,44,0.6)]"
          : "glass text-[var(--ink-soft)]"
      }`}
      style={
        selected
          ? { background: "rgba(255,255,255,0.95)", border: "1px solid rgba(231,146,156,0.6)" }
          : undefined
      }
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
}

/* ---------------- Animated score ring ---------------- */
export function ScoreRing({ score, size = 168 }: { score: number; size?: number }) {
  const [shown, setShown] = useState(0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(eased * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const offset = c - (shown / 100) * c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#73def4" />
            <stop offset="50%" stopColor="#f7a6e0" />
            <stop offset="100%" stopColor="#ffd166" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(54,32,44,0.08)" strokeWidth="12" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-5xl font-semibold leading-none text-[var(--ink)]">
          {shown}
        </span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
          out of 100
        </span>
      </div>
    </div>
  );
}

/* ---------------- Round icon button ---------------- */
export function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="press glass grid h-10 w-10 place-items-center rounded-full text-[var(--ink)]"
    >
      {children}
    </button>
  );
}

/* count-up hook reused elsewhere if needed */
export function useCountUp(target: number, dur = 900) {
  const [v, setV] = useState(0);
  const ref = useRef(target);
  ref.current = target;
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * ref.current));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dur]);
  return v;
}
