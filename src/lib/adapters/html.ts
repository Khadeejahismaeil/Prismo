import { makeIR, type DesignNode, type IR, type IRColor } from "../ir";
import type { RGB } from "../wcag";

/**
 * HTML adapter — walks an already-rendered DOM into the IR. Pure given a
 * document + its window (the iframe lifecycle lives in render/htmlIR.ts), so
 * geometry and colours come from getBoundingClientRect / getComputedStyle —
 * real values, never inferred from pixels.
 */

const MAX_NODES = 220;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "HEAD", "META", "LINK", "TITLE", "NOSCRIPT", "BR", "TEMPLATE"]);

/** Parse a computed CSS colour ("rgb(...)" / "rgba(...)") into rgb + alpha. */
function parseCssColor(v: string): { rgb: RGB; a: number } | null {
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { rgb: [Math.round(parts[0]), Math.round(parts[1]), Math.round(parts[2])], a: parts[3] ?? 1 };
}

const composite = (fg: RGB, a: number, bg: RGB): RGB =>
  [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))) as RGB;

/** The effective background behind an element: climb ancestors flattening
 *  colours, bail to indeterminate on any gradient/image or unflattenable alpha. */
function resolveBg(el: Element, win: Window): IRColor {
  let node: Element | null = el;
  let acc: { rgb: RGB; a: number } | null = null; // colour accumulated so far (front-to-back)
  while (node) {
    const cs = win.getComputedStyle(node);
    if (cs.backgroundImage && cs.backgroundImage !== "none") {
      return { rgb: null, raw: cs.backgroundImage.slice(0, 40), indeterminate: true };
    }
    const c = parseCssColor(cs.backgroundColor);
    if (c && c.a > 0) {
      if (!acc) acc = c;
      else acc = { rgb: composite(acc.rgb, acc.a, c.rgb), a: acc.a + (1 - acc.a) * c.a };
      if (acc.a >= 0.999) return { rgb: acc.rgb, raw: `rgb(${acc.rgb.join(",")})` };
    }
    node = node.parentElement;
  }
  // Reached the root with no opaque backing — assume white (default canvas).
  if (acc) return { rgb: composite(acc.rgb, acc.a, [255, 255, 255]), raw: `rgb(${acc.rgb.join(",")})` };
  return { rgb: [255, 255, 255], raw: "rgb(255,255,255)" };
}

function textColor(cs: CSSStyleDeclaration): IRColor {
  const c = parseCssColor(cs.color);
  if (!c) return { rgb: null };
  if (c.a >= 0.999) return { rgb: c.rgb, raw: cs.color };
  // Semi-transparent text — composite over white as a best-effort, but flag it.
  return { rgb: composite(c.rgb, c.a, [255, 255, 255]), raw: cs.color, indeterminate: c.a < 0.6 };
}

/** Direct (non-descendant) text of an element, trimmed. */
function directText(el: Element): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent ?? "";
  });
  return out.replace(/\s+/g, " ").trim();
}

function roleOf(el: Element, hasText: boolean): string {
  const tag = el.tagName;
  if (/^H[1-6]$/.test(tag)) return "heading";
  const roleAttr = el.getAttribute("role");
  if (tag === "BUTTON" || roleAttr === "button") return "button";
  if (tag === "A") return "link";
  if (tag === "IMG" || tag === "SVG" || tag === "PICTURE") return "image";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return "input";
  if (hasText && (tag === "P" || tag === "SPAN" || tag === "LI" || tag === "LABEL" || tag === "A")) return "text";
  return hasText ? "text" : "container";
}

/** Walk a rendered document body into an IR. */
export function walkHtml(body: HTMLElement, win: Window, viewport: { w: number; h: number }): IR {
  let counter = 0;
  let budget = MAX_NODES;
  const scrollX = win.scrollX || 0;
  const scrollY = win.scrollY || 0;

  const convert = (el: Element): DesignNode | null => {
    if (budget <= 0 || SKIP_TAGS.has(el.tagName)) return null;
    const cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return null;

    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);

    const kids: DesignNode[] = [];
    for (const child of Array.from(el.children)) {
      const c = convert(child);
      if (c) kids.push(c);
    }

    const text = directText(el);
    const hasText = text.length >= 1;
    // Drop zero-area, textless wrappers, but keep their children (flattened up).
    if (w <= 0 || h <= 0) return null;
    if (!hasText && kids.length === 1 && sameBox(kids[0].bbox, r, scrollX, scrollY)) {
      return kids[0]; // collapse a pure single-child wrapper
    }

    budget--;
    const fontPx = parseFloat(cs.fontSize) || undefined;
    return {
      id: `n${counter++}`,
      role: roleOf(el, hasText),
      tag: el.tagName.toLowerCase(),
      ...(hasText ? { text: text.slice(0, 200) } : {}),
      bbox: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w, h },
      color: hasText ? textColor(cs) : { rgb: null },
      bg: resolveBg(el, win),
      ...(fontPx ? { fontPx: Math.round(fontPx) } : {}),
      ...(cs.fontWeight ? { fontWeight: parseInt(cs.fontWeight, 10) || undefined } : {}),
      ...(cs.fontFamily ? { fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim() } : {}),
      ...(cs.gap && cs.gap !== "normal" ? { gap: parseFloat(cs.gap) || undefined } : {}),
      opacity: parseFloat(cs.opacity) || 1,
      children: kids,
    };
  };

  // Synthesize a root wrapping the body so the tree always has one entry.
  let root = convert(body);
  if (!root) {
    root = {
      id: "n0",
      role: "container",
      tag: "body",
      bbox: { x: 0, y: 0, w: viewport.w, h: viewport.h },
      color: { rgb: null },
      bg: { rgb: [255, 255, 255] },
      children: [],
    };
  }
  return makeIR("html", viewport, root);
}

function sameBox(a: { x: number; y: number; w: number; h: number }, r: DOMRect, sx: number, sy: number): boolean {
  return (
    Math.abs(a.x - (r.left + sx)) < 2 &&
    Math.abs(a.y - (r.top + sy)) < 2 &&
    Math.abs(a.w - r.width) < 2 &&
    Math.abs(a.h - r.height) < 2
  );
}
