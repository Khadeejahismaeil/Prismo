import { makeIR, type DesignNode, type IR, type IRColor } from "../ir";
import type { RGB } from "../wcag";

/**
 * Figma JSON adapter — pure parse, no rendering. Accepts an exported Figma node
 * tree (a `document` node from the REST `GET /files` response, a `nodes` entry,
 * or a single pasted node subtree) and normalises it into the IR.
 *
 * Figma exports vary by API version and plugin, so every field access is
 * defensive: nodes without geometry are skipped rather than throwing.
 */

/* Loosely-typed view of the bits of the Figma schema we read. */
type FigmaPaint = {
  type?: string;
  color?: { r: number; g: number; b: number; a?: number };
  opacity?: number;
  visible?: boolean;
};
type FigmaNode = {
  id?: string;
  name?: string;
  type?: string;
  characters?: string;
  visible?: boolean;
  opacity?: number;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  fills?: FigmaPaint[];
  style?: { fontSize?: number; fontWeight?: number; fontFamily?: string };
  children?: FigmaNode[];
};

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** First visible SOLID fill → RGB; gradient/image/none → indeterminate. */
function solidFill(fills: FigmaPaint[] | undefined): IRColor {
  const visible = (fills ?? []).filter((f) => f && f.visible !== false && (f.opacity ?? 1) > 0);
  if (!visible.length) return { rgb: null };
  const first = visible[0];
  if (first.type === "SOLID" && first.color) {
    const rgb: RGB = [clamp255(first.color.r), clamp255(first.color.g), clamp255(first.color.b)];
    const semi = (first.color.a ?? 1) < 0.999 || (first.opacity ?? 1) < 0.999;
    return { rgb, raw: `rgb(${rgb.join(",")})`, ...(semi ? { indeterminate: true } : {}) };
  }
  // GRADIENT_* / IMAGE / etc. — no single flat colour.
  return { rgb: null, raw: first.type ?? "unknown", indeterminate: true };
}

function roleOf(type: string | undefined, name: string | undefined, hasText: boolean): string {
  const t = (type ?? "").toUpperCase();
  const n = (name ?? "").toLowerCase();
  if (t === "TEXT") {
    if (/(h1|title|headline|heading)/.test(n)) return "heading";
    if (/(button|btn|cta)/.test(n)) return "button";
    return "text";
  }
  if (/(button|btn|cta)/.test(n)) return "button";
  if (t === "RECTANGLE" && /(image|img|photo|avatar)/.test(n)) return "image";
  if (hasText) return "text";
  return "container";
}

export function isFigmaJson(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const root = (v.document ?? v) as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") return false;
  return (
    "absoluteBoundingBox" in root ||
    "children" in root ||
    (typeof root.type === "string" && Array.isArray((root as { children?: unknown }).children))
  );
}

/** Parse an exported Figma JSON tree into an IR. Throws only if there is no
 *  usable geometry anywhere (nothing to review). */
export function parseFigma(raw: unknown): IR {
  const top = (raw as { document?: FigmaNode } | FigmaNode) ?? {};
  const document = (top as { document?: FigmaNode }).document ?? (top as FigmaNode);

  // Pick the frame to review: the first descendant that has geometry.
  const frame = findFramed(document);
  if (!frame || !frame.absoluteBoundingBox) {
    throw new Error("This Figma JSON has no positioned frames to review. Export a frame or screen node.");
  }

  const origin = { x: frame.absoluteBoundingBox.x, y: frame.absoluteBoundingBox.y };
  const viewport = { w: Math.round(frame.absoluteBoundingBox.width), h: Math.round(frame.absoluteBoundingBox.height) };

  let counter = 0;
  const nextId = () => `n${counter++}`;

  const convert = (node: FigmaNode, inheritedBg: IRColor): DesignNode | null => {
    if (node.visible === false) return null;
    const box = node.absoluteBoundingBox;
    if (!box || box.width <= 0 || box.height <= 0) {
      // No geometry of its own, but it may still contain positioned children.
      const kids = collectChildren(node.children, inheritedBg, convert);
      return kids.length ? passthrough(nextId(), kids) : null;
    }

    const ownBg = solidFill(node.fills);
    const bg: IRColor = ownBg.rgb || ownBg.indeterminate ? ownBg : inheritedBg;
    const hasText = typeof node.characters === "string" && node.characters.trim().length > 0;

    const dn: DesignNode = {
      id: nextId(),
      role: roleOf(node.type, node.name, hasText),
      tag: node.type ?? "NODE",
      ...(hasText ? { text: node.characters!.trim().slice(0, 200) } : {}),
      bbox: {
        x: Math.round(box.x - origin.x),
        y: Math.round(box.y - origin.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
      },
      // TEXT paints ITS OWN glyphs, so its fill is the foreground; the background
      // is whatever it sits on (inherited). Containers use their fill as bg.
      color: hasText ? ownBg : { rgb: null },
      bg: hasText ? inheritedBg : bg,
      ...(node.style?.fontSize ? { fontPx: Math.round(node.style.fontSize) } : {}),
      ...(node.style?.fontWeight ? { fontWeight: node.style.fontWeight } : {}),
      ...(node.style?.fontFamily ? { fontFamily: node.style.fontFamily } : {}),
      ...(node.opacity != null ? { opacity: node.opacity } : {}),
      children: collectChildren(node.children, bg, convert),
    };
    return dn;
  };

  const root = convert(frame, { rgb: [255, 255, 255] });
  if (!root) throw new Error("Could not read any reviewable nodes from this Figma export.");

  return makeIR("figma", viewport, root);
}

/** A structural pass-through node when a group has no box of its own; its bbox
 *  is the union of its children so markers still resolve. */
function passthrough(id: string, children: DesignNode[]): DesignNode {
  const x = Math.min(...children.map((c) => c.bbox.x));
  const y = Math.min(...children.map((c) => c.bbox.y));
  const x2 = Math.max(...children.map((c) => c.bbox.x + c.bbox.w));
  const y2 = Math.max(...children.map((c) => c.bbox.y + c.bbox.h));
  return {
    id,
    role: "container",
    tag: "GROUP",
    bbox: { x, y, w: x2 - x, h: y2 - y },
    color: { rgb: null },
    bg: { rgb: null },
    children,
  };
}

function collectChildren(
  kids: FigmaNode[] | undefined,
  bg: IRColor,
  convert: (n: FigmaNode, bg: IRColor) => DesignNode | null,
): DesignNode[] {
  const out: DesignNode[] = [];
  for (const k of kids ?? []) {
    const c = convert(k, bg);
    if (c) out.push(c);
  }
  return out;
}

/** Depth-first search for the first node that carries geometry. */
function findFramed(node: FigmaNode | undefined): FigmaNode | undefined {
  if (!node) return undefined;
  if (node.absoluteBoundingBox && node.absoluteBoundingBox.width > 0) return node;
  for (const c of node.children ?? []) {
    const f = findFramed(c);
    if (f) return f;
  }
  return undefined;
}
