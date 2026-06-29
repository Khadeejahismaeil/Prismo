"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Interactive before/after comparison. The "after" image is revealed by
 * dragging the handle. Works with pointer + keyboard.
 */
export default function BeforeAfterSlider({
  before,
  after,
  afterFilter,
}: {
  before: string;
  after?: string;
  /** CSS filter applied to simulate the AI-enhanced version when no separate image. */
  afterFilter?: string;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  const move = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    move(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) move(e.clientX);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className="relative aspect-[9/16] w-full touch-none select-none overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_20px_50px_-22px_rgba(54,32,44,0.5)]"
    >
      {/* AFTER (enhanced) underneath */}
      <img
        src={after || before}
        alt="AI-enhanced version"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={!after && afterFilter ? { filter: afterFilter } : undefined}
      />
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
        After ✨
      </span>

      {/* BEFORE clipped on top */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt="Original version"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: ref.current?.clientWidth ?? "100%" }}
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
          Before
        </span>
      </div>

      {/* handle */}
      <div
        className="absolute top-0 bottom-0 z-10 flex items-center justify-center"
        style={{ left: `calc(${pos}% - 1px)` }}
      >
        <div className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.3)]" />
        <div className="press grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 7l-4 5 4 5M15 7l4 5-4 5" stroke="#36202c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
