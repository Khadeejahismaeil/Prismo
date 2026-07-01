import { contrastRatio, toHex, type RGB } from "./wcag";
import type { SourceKind } from "./types";

/**
 * Intermediate Representation (IR): a source-agnostic design tree with REAL
 * geometry and colours. HTML and Figma inputs are normalised into this shape
 * by their adapters; the analysis pipeline consumes only the IR, never pixels.
 *
 * Pure and isomorphic (no `server-only`): the HTML adapter builds it in the
 * browser, the Figma adapter and the measurement run on either side.
 */

export type IRColor = {
  /** Effective sRGB, composited over ancestors where known. null = indeterminate. */
  rgb: RGB | null;
  /** Raw source value for display/debug, e.g. "rgb(30,30,30)" or "linear-gradient(...)". */
  raw?: string;
  /** True when no single flat colour could be resolved (gradient, image, alpha stack). */
  indeterminate?: boolean;
};

export type DesignNode = {
  /** Stable id assigned in deterministic walk order ("n0","n1",…). */
  id: string;
  /** Semantic guess: "heading" | "button" | "text" | "image" | "container" | "input" | ... */
  role: string;
  /** Source tag ("h1","button","div") or Figma type ("TEXT","FRAME"). */
  tag: string;
  text?: string;
  /** px in the render viewport / normalised frame space. */
  bbox: { x: number; y: number; w: number; h: number };
  /** Foreground / text colour. */
  color: IRColor;
  /** Resolved effective background behind this node. */
  bg: IRColor;
  fontPx?: number;
  fontWeight?: number;
  fontFamily?: string;
  padding?: [number, number, number, number]; // t,r,b,l
  margin?: [number, number, number, number];
  gap?: number;
  opacity?: number;
  zIndex?: number;
  children: DesignNode[];
};

export type IR = {
  kind: SourceKind;
  /** Coordinate space the bboxes live in. */
  viewport: { w: number; h: number };
  root: DesignNode;
  /** Flat id→node index for O(1) lookup. */
  flat: Record<string, DesignNode>;
};

/** Build the flat id→node index for a tree. */
export function flatten(root: DesignNode): Record<string, DesignNode> {
  const flat: Record<string, DesignNode> = {};
  const walk = (n: DesignNode) => {
    flat[n.id] = n;
    for (const c of n.children) walk(c);
  };
  walk(root);
  return flat;
}

/** Convenience: assemble an IR from a root node + viewport. */
export function makeIR(kind: SourceKind, viewport: { w: number; h: number }, root: DesignNode): IR {
  return { kind, viewport, root, flat: flatten(root) };
}

/**
 * Centre of a node's bbox as percentages of the viewport — the coordinate the
 * existing Results markers consume (same math as marks.ts). Clamped to 0..100.
 */
export function nodeCenterPct(node: DesignNode, viewport: { w: number; h: number }): { x: number; y: number } {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return {
    x: clamp(Math.round(((node.bbox.x + node.bbox.w / 2) / (viewport.w || 1)) * 1000) / 10),
    y: clamp(Math.round(((node.bbox.y + node.bbox.h / 2) / (viewport.h || 1)) * 1000) / 10),
  };
}

/* ---------------- deterministic measurement over the IR ---------------- */

export type IRMeasurement = {
  nodeId: string;
  text: string;
  fontPx: number;
  /** null when the effective colour pair could not be resolved. */
  contrast: number | null;
  aa: boolean;
  aaLarge: boolean;
  status: "ok" | "incomplete";
};

export type IRMeasurements = {
  /** Text-bearing elements only. */
  elements: IRMeasurement[];
  /** Fraction of RESOLVABLE text elements failing WCAG AA (0..1). */
  contrastFailRate: number;
  /** How many text elements had indeterminate contrast (couldn't be measured). */
  incompleteCount: number;
  /** max fontPx / median fontPx among text elements. */
  hierarchyRatio: number;
  palette: { hex: string; pct: number }[];
};

const isLarge = (fontPx: number) => fontPx >= 28;

/** WCAG contrast + hierarchy + palette computed from REAL IR values. */
export function measureIR(ir: IR): IRMeasurements {
  const nodes = Object.values(ir.flat);

  const textNodes = nodes.filter((n) => (n.text ?? "").trim().length >= 2 && (n.fontPx ?? 0) > 0);
  const elements: IRMeasurement[] = textNodes.map((n) => {
    const fontPx = n.fontPx ?? 0;
    if (n.color.rgb && n.bg.rgb && !n.color.indeterminate && !n.bg.indeterminate) {
      const contrast = Math.round(contrastRatio(n.color.rgb, n.bg.rgb) * 100) / 100;
      return {
        nodeId: n.id,
        text: (n.text ?? "").slice(0, 60),
        fontPx,
        contrast,
        aa: contrast >= 4.5,
        aaLarge: contrast >= 3,
        status: "ok" as const,
      };
    }
    return {
      nodeId: n.id,
      text: (n.text ?? "").slice(0, 60),
      fontPx,
      contrast: null,
      aa: false,
      aaLarge: false,
      status: "incomplete" as const,
    };
  });

  const resolvable = elements.filter((e) => e.status === "ok");
  const fails = resolvable.filter((e) => (isLarge(e.fontPx) ? !e.aaLarge : !e.aa));
  const contrastFailRate = resolvable.length ? Math.round((fails.length / resolvable.length) * 100) / 100 : 0;
  const incompleteCount = elements.length - resolvable.length;

  // Hierarchy: spread between the biggest type and the median.
  const sizes = elements.map((e) => e.fontPx).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 1;
  const max = sizes[sizes.length - 1] || 1;
  const hierarchyRatio = Math.round((max / median) * 100) / 100;

  return {
    elements,
    contrastFailRate,
    incompleteCount,
    hierarchyRatio,
    palette: paletteFromNodes(nodes),
  };
}

/** Area-weighted palette from resolved node backgrounds + text colours. */
function paletteFromNodes(nodes: DesignNode[]): { hex: string; pct: number }[] {
  const weight = new Map<string, { hex: string; area: number }>();
  const add = (c: IRColor, area: number) => {
    if (!c.rgb || c.indeterminate || area <= 0) return;
    const hex = toHex(c.rgb);
    const e = weight.get(hex);
    if (e) e.area += area;
    else weight.set(hex, { hex, area });
  };
  for (const n of nodes) {
    const area = Math.max(0, n.bbox.w) * Math.max(0, n.bbox.h);
    add(n.bg, area);
    // text colour weighted by a nominal glyph area so it registers without dominating
    if (n.text) add(n.color, Math.min(area, (n.fontPx ?? 12) * (n.text.length * (n.fontPx ?? 12) * 0.5)));
  }
  const total = [...weight.values()].reduce((s, e) => s + e.area, 0) || 1;
  return [...weight.values()]
    .sort((a, b) => b.area - a.area)
    .slice(0, 6)
    .map((e) => ({ hex: e.hex, pct: Math.round((e.area / total) * 100) }));
}
