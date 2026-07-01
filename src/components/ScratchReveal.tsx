"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Logical layout width the design is rendered at before scaling to fit. */
const LW = 390;

/**
 * The glow-up viewer. The improved design sits under sparkling dust you swipe
 * away, with a Before / After toggle. The design is rendered at a fixed logical
 * width and scaled to fit the available space, so the WHOLE thing is visible
 * with NO scrolling — at its true proportions.
 */
export default function ScratchReveal({
  before,
  beforeHtml,
  afterFilter,
  afterHtml,
  aspectRatio,
}: {
  before?: string;
  beforeHtml?: string;
  afterFilter?: string;
  afterHtml?: string;
  aspectRatio?: number;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastSample = useRef(0);
  const strokes = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [view, setView] = useState<"after" | "before">("after");
  const [avail, setAvail] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const ar = aspectRatio ?? 9 / 16;
  const guessH = Math.round(LW / ar);
  // Logical content heights (measured from the rendered content).
  const [afterH, setAfterH] = useState(guessH);
  const [beforeH, setBeforeH] = useState(guessH);

  const canToggle = Boolean(afterHtml);
  const dustActive = view === "after" && !revealed;

  // Which content height drives the card right now.
  const activeH = view === "before" ? beforeH : afterHtml ? afterH : beforeH;
  // Fit to WIDTH — the design fills the column and the page scrolls a little if
  // it's taller than the viewport (never an internal iframe scroll).
  const scale = avail.w ? avail.w / LW : 0;
  const cardW = Math.round(LW * scale);
  const cardH = Math.round(activeH * scale);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 100}%`,
        size: 8 + ((i * 7) % 16),
        dur: `${1.8 + ((i * 13) % 22) / 10}s`,
        delay: `${((i * 29) % 20) / 10}s`,
      })),
    [],
  );

  // Track the available box.
  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** True content height of a same-origin srcdoc iframe. We measure the bottom
   *  of the body's children (not scrollHeight), so `html,body{height:100%}`
   *  doesn't inflate it to the iframe's own height. */
  const measureFrame = (el: HTMLIFrameElement, set: (h: number) => void) => {
    try {
      const doc = el.contentDocument;
      const body = doc?.body;
      if (!body) return;
      let bottom = 0;
      for (const child of Array.from(body.children)) {
        bottom = Math.max(bottom, (child as HTMLElement).getBoundingClientRect().bottom);
      }
      const padBottom = parseFloat(doc!.defaultView!.getComputedStyle(body).paddingBottom) || 0;
      const h = Math.ceil(bottom + padBottom);
      if (h > 40) set(h);
    } catch {
      /* cross-origin — keep the guess */
    }
  };

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

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#f8c8e8");
    g.addColorStop(0.45, "#cdb8f5");
    g.addColorStop(1, "#a9e7f6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

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
    if (!dustActive || !cardW || !cardH) return;
    const id = requestAnimationFrame(paintDust);
    return () => cancelAnimationFrame(id);
  }, [dustActive, paintDust, cardW, cardH]);

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
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(clientX - rect.left, clientY - rect.top, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      strokes.current += 1;
      const now = performance.now();
      if (strokes.current > 6 && now - lastSample.current > 140) {
        lastSample.current = now;
        sample(ctx, canvas.width, canvas.height);
      }
    },
    [sample],
  );

  /** A design layer rendered at LW and scaled by `scale`, positioned top-left. */
  const layer = (node: React.ReactNode, logicalH: number, z: number) => (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: LW,
        height: logicalH,
        transform: `scale(${scale || 0.0001})`,
        transformOrigin: "top left",
        zIndex: z,
      }}
    >
      {node}
    </div>
  );

  const htmlFrame = (srcDoc: string, h: number, set: (n: number) => void) => (
    <iframe
      title="design"
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      scrolling="no"
      style={{ width: LW, height: h, border: 0, background: "#fff" }}
      onLoad={(e) => measureFrame(e.currentTarget, set)}
    />
  );

  const rasterImg = (src: string, filter?: string) => (
    <img
      src={src}
      alt="design"
      draggable={false}
      style={{ width: LW, height: "auto", display: "block", ...(filter ? { filter } : {}) }}
      onLoad={(e) => {
        const el = e.currentTarget;
        if (el.naturalWidth) {
          const h = Math.round((LW * el.naturalHeight) / el.naturalWidth);
          setAfterH(h);
          setBeforeH(h);
        }
      }}
    />
  );

  const afterNode = afterHtml
    ? htmlFrame(afterHtml, afterH, setAfterH)
    : beforeHtml
      ? htmlFrame(beforeHtml, beforeH, setBeforeH)
      : before
        ? rasterImg(before, afterFilter)
        : null;

  const beforeNode = beforeHtml ? htmlFrame(beforeHtml, beforeH, setBeforeH) : before ? rasterImg(before) : null;

  return (
    <div ref={fitRef} className="flex w-full justify-center">
      <div
        ref={wrapRef}
        style={{ width: cardW || undefined, height: cardH || undefined }}
        className="relative touch-none select-none overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_20px_50px_-22px_rgba(54,32,44,0.5)]"
      >
        {afterNode && layer(afterNode, afterHtml ? afterH : beforeH, 0)}
        {view === "before" && beforeNode && layer(beforeNode, beforeH, 30)}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
          style={{ display: dustActive ? "block" : "none", zIndex: 35 }}
          onPointerDown={(e) => {
            drawing.current = true;
            try {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            } catch {
              /* ignore */
            }
            erase(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (drawing.current && e.buttons === 1) erase(e.clientX, e.clientY);
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        />

        {dustActive && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 36 }}>
            {sparkles.map((s, i) => (
              <span
                key={i}
                className="sparkle"
                style={{ left: s.left, top: s.top, fontSize: s.size, ["--dur" as string]: s.dur, animationDelay: s.delay }}
              >
                ✦
              </span>
            ))}
          </div>
        )}

        {canToggle && (
          <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 gap-0.5 rounded-full bg-black/45 p-0.5 backdrop-blur">
            {(["before", "after"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`press rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  view === v ? "bg-white text-[var(--ink)]" : "text-white/85"
                }`}
              >
                {v === "before" ? "Before" : "After ✨"}
              </button>
            ))}
          </div>
        )}

        {revealed && view === "after" && (
          <button
            onClick={paintDust}
            className="press absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur"
          >
            ✨ Sprinkle again
          </button>
        )}
      </div>
    </div>
  );
}
