"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Magic-dust reveal. The enhanced design sits underneath a layer of sparkling
 * dust painted on a canvas; the user swipes to wipe the dust away and reveal
 * the glow-up. Once enough is cleared it dissolves the rest on its own.
 */
export default function ScratchReveal({
  before,
  afterFilter,
  afterHtml,
}: {
  before: string;
  afterFilter?: string;
  /** When set, the revealed "after" is a live HTML mockup instead of the image. */
  afterHtml?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastSample = useRef(0);
  const strokes = useRef(0);
  const [revealed, setRevealed] = useState(false);

  const paintDust = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;

    // base magical gradient
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#f8c8e8");
    g.addColorStop(0.45, "#cdb8f5");
    g.addColorStop(1, "#a9e7f6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soft glowing blobs
    const blobs = [
      [w * 0.25, h * 0.3, "#ffe39e"],
      [w * 0.75, h * 0.6, "#ffc2e0"],
      [w * 0.5, h * 0.85, "#bfeaff"],
    ] as const;
    blobs.forEach(([bx, by, col]) => {
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, w * 0.5);
      rg.addColorStop(0, col + "cc");
      rg.addColorStop(1, col + "00");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    });

    // sparkle stars (deterministic positions)
    const star = (cx: number, cy: number, r: number, a: number) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = (Math.PI / 2) * i;
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.lineTo(cx + Math.cos(ang + Math.PI / 4) * r * 0.32, cy + Math.sin(ang + Math.PI / 4) * r * 0.32);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    let s = 7;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < 90; i++) {
      star(rnd() * w, rnd() * h, 2 + rnd() * 5, 0.5 + rnd() * 0.5);
    }

    // hint
    ctx.fillStyle = "rgba(83,46,68,0.8)";
    ctx.font = "600 15px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✨ swipe away the magic ✨", w / 2, h / 2);

    canvas.style.opacity = "1";
    canvas.style.pointerEvents = "auto";
    strokes.current = 0;
    setRevealed(false);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(paintDust);
    return () => cancelAnimationFrame(id);
  }, [paintDust]);

  const finish = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.transition = "opacity 0.6s ease";
    canvas.style.opacity = "0";
    canvas.style.pointerEvents = "none";
    setRevealed(true);
  }, []);

  const sample = useCallback(
    (ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
      const data = ctx.getImageData(0, 0, cw, ch).data;
      let cleared = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * 64) {
        total++;
        if (data[i] < 24) cleared++;
      }
      if (total && cleared / total > 0.5) finish();
    },
    [finish],
  );

  const erase = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // require real swiping before we consider auto,revealing
      strokes.current += 1;
      const now = performance.now();
      if (strokes.current > 6 && now - lastSample.current > 140) {
        lastSample.current = now;
        sample(ctx, canvas.width, canvas.height);
      }
    },
    [sample],
  );

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[9/16] w-full touch-none select-none overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_20px_50px_-22px_rgba(54,32,44,0.5)]"
    >
      {/* enhanced design underneath */}
      {afterHtml ? (
        <iframe
          title="Your enhanced design"
          srcDoc={afterHtml}
          sandbox=""
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
      ) : (
        <img
          src={before}
          alt="Your enhanced design"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={afterFilter ? { filter: afterFilter } : undefined}
        />
      )}

      {/* before reference chip */}
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 flex flex-col items-center">
        <div className="h-14 w-9 overflow-hidden rounded-lg border-2 border-white/90 shadow-md">
          <img src={before} alt="" className="h-full w-full object-cover" />
        </div>
        <span className="mt-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          Before
        </span>
      </div>

      {/* revealed badge */}
      <span
        className="absolute right-3 top-3 z-20 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition-opacity duration-500"
        style={{ opacity: revealed ? 1 : 0 }}
      >
        After ✨
      </span>

      {/* dust canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          drawing.current = true;
          try {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          } catch {
            /* pointer not active (e.g. synthetic events) — safe to ignore */
          }
          erase(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (drawing.current) erase(e.clientX, e.clientY);
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
      />

      {/* scratch again */}
      {revealed && (
        <button
          onClick={paintDust}
          className="press absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur"
        >
          ✨ Sprinkle again
        </button>
      )}
    </div>
  );
}
