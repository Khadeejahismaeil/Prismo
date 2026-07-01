"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Source } from "@/lib/types";
import { MEASURE_WIDTH } from "@/lib/render/htmlIR";
import { parseFigma } from "@/lib/adapters/figma";
import type { DesignNode, IR } from "@/lib/ir";
import { toHex } from "@/lib/wcag";

/**
 * Renders a design Source (raster image, live HTML, or a Figma reconstruction)
 * inside a positioned wrapper, with `children` (the annotation markers) overlaid
 * on top. Markers position by percentage, so they land correctly over any of
 * the three preview kinds.
 *
 * HTML/Figma are rendered at the SAME viewport width the IR was measured at
 * (MEASURE_WIDTH) and visually scaled to fit — so the marker percentages align.
 */
export default function SourcePreview({
  source,
  viewport,
  children,
}: {
  source: Source;
  viewport?: { w: number; h: number };
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Figma has no live DOM — rebuild the IR client-side for a visual reconstruction.
  const figmaIR = useMemo<IR | null>(() => {
    if (source.kind !== "figma") return null;
    try {
      return parseFigma(JSON.parse(source.payload));
    } catch {
      return null;
    }
  }, [source]);

  if (source.kind === "raster") {
    return (
      <div ref={ref} className="relative">
        <img src={source.payload} alt="Your design with annotations" className="block w-full" />
        {children}
      </div>
    );
  }

  const vp = viewport ?? figmaIR?.viewport ?? { w: MEASURE_WIDTH, h: Math.round((MEASURE_WIDTH * 16) / 9) };
  const scale = width ? width / vp.w : 0;
  const height = vp.h * scale;

  return (
    <div ref={ref} className="relative w-full overflow-hidden bg-white" style={{ height: height || undefined }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: vp.w,
          height: vp.h,
          transform: `scale(${scale || 0.0001})`,
          transformOrigin: "top left",
        }}
      >
        {source.kind === "html" ? (
          <iframe
            title="Your design"
            srcDoc={source.payload}
            sandbox=""
            style={{ width: vp.w, height: vp.h, border: 0, background: "#fff" }}
          />
        ) : figmaIR ? (
          <FigmaNode node={figmaIR.root} />
        ) : (
          <div style={{ width: vp.w, height: vp.h }} className="grid place-items-center text-sm text-[var(--ink-soft)]">
            Couldn&apos;t render this Figma file
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Lightweight Figma reconstruction: absolutely-positioned boxes from IR bboxes. */
function FigmaNode({ node }: { node: DesignNode }) {
  const bg = node.bg.rgb && !node.bg.indeterminate ? toHex(node.bg.rgb) : undefined;
  const color = node.color.rgb && !node.color.indeterminate ? toHex(node.color.rgb) : undefined;
  return (
    <div
      style={{
        position: "absolute",
        left: node.bbox.x,
        top: node.bbox.y,
        width: node.bbox.w,
        height: node.bbox.h,
        background: bg,
        color,
        fontSize: node.fontPx,
        fontWeight: node.fontWeight,
        fontFamily: node.fontFamily,
        display: node.text ? "flex" : undefined,
        alignItems: node.text ? "center" : undefined,
        overflow: "hidden",
        lineHeight: 1.1,
      }}
    >
      {node.text ?? null}
      {node.children.map((c) => (
        <FigmaNode key={c.id} node={c} />
      ))}
    </div>
  );
}
